-- Import an entire bounded archive batch in one transaction.
-- A retry skips the same shortcut + exact response text, while different
-- replies under the same shortcut are kept. This function is callable
-- only with the Worker-held service role, never with a browser key.
create function public.import_responses_batch(
  p_agent_id uuid,
  p_visibility text,
  p_responses jsonb
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_role text;
  v_entry jsonb;
  v_name text;
  v_body text;
  v_shortcut_id uuid;
  v_imported integer := 0;
  v_skipped integer := 0;
begin
  if p_visibility is null or p_visibility not in ('shared', 'private')
    or p_responses is null or pg_catalog.jsonb_typeof(p_responses) <> 'array' then
    raise exception 'Invalid import scope or responses' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_responses) not between 1 and 50 then
    raise exception 'Import must contain 1 to 50 responses' using errcode = '22023';
  end if;

  select a.role into v_role
  from public.agents a
  where a.id = p_agent_id and a.disabled_at is null;
  if v_role is null or (p_visibility = 'shared' and v_role <> 'admin') then
    raise exception 'Import not authorized' using errcode = '42501';
  end if;

  -- Serialize concurrent imports to the same scope so a retry cannot
  -- insert the same shortcut/text pair twice.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('archive-import:' || p_visibility),
    pg_catalog.hashtext(case when p_visibility = 'shared' then 'shared' else p_agent_id::text end)
  );

  for v_entry in select value from pg_catalog.jsonb_array_elements(p_responses)
  loop
    if pg_catalog.jsonb_typeof(v_entry) <> 'object' then
      raise exception 'Invalid response entry' using errcode = '22023';
    end if;
    v_name := v_entry ->> 'shortcut';
    v_body := v_entry ->> 'body';
    if v_name is null or v_name !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'
      or v_body is null or pg_catalog.char_length(v_body) > 10000
      or pg_catalog.char_length(pg_catalog.btrim(v_body)) = 0 then
      raise exception 'Invalid shortcut or response body' using errcode = '22023';
    end if;

    insert into public.shortcuts (name, visibility, owner_id)
    values (v_name, p_visibility, p_agent_id)
    on conflict do nothing;

    select s.id into v_shortcut_id
    from public.shortcuts s
    where s.name_key = pg_catalog.lower(v_name)
      and s.visibility = p_visibility
      and (p_visibility = 'shared' or s.owner_id = p_agent_id)
    limit 1;

    if v_shortcut_id is null then
      raise exception 'Could not resolve imported shortcut' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.canned_responses r
      where r.shortcut_id = v_shortcut_id
        and r.visibility = p_visibility
        and r.body = v_body
        and (p_visibility = 'shared' or r.owner_id = p_agent_id)
    ) then
      v_skipped := v_skipped + 1;
    else
      insert into public.canned_responses(shortcut_id, visibility, owner_id, body)
      values (v_shortcut_id, p_visibility, p_agent_id, v_body);
      v_imported := v_imported + 1;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object('imported', v_imported, 'skipped', v_skipped);
end;
$$;

revoke all on function public.import_responses_batch(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_responses_batch(uuid, text, jsonb) to service_role;

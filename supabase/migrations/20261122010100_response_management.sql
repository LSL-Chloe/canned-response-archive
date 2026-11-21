-- Atomic scope changes and bulk deletion for the response library.
-- The browser cannot invoke these functions. Only the session-verifying Worker
-- sends an actor ID with the server-held service role. Recheck that identity,
-- role and current ownership inside each transaction to prevent stale-page races.
create function public.update_archive_response(
  p_actor_id uuid,
  p_response_id uuid,
  p_body text,
  p_shortcut text,
  p_visibility text
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_role text;
  v_row public.canned_responses%rowtype;
  v_shortcut_id uuid;
  v_shortcut_name text;
  v_result public.canned_responses%rowtype;
begin
  if p_visibility is null or p_visibility not in ('shared','private')
    or p_shortcut is null or p_shortcut !~ '^[A-Za-z0-9_][A-Za-z0-9_ -]{0,63}$'
    or p_shortcut <> pg_catalog.btrim(p_shortcut)
    or p_body is null or pg_catalog.char_length(p_body) > 10000
    or pg_catalog.char_length(pg_catalog.btrim(p_body)) = 0 then
    raise exception 'Invalid response update' using errcode = '22023';
  end if;

  select a.role into v_role
    from public.agents a where a.id = p_actor_id and a.disabled_at is null;
  if v_role is null then
    raise exception 'Account unavailable' using errcode = '42501';
  end if;

  select * into v_row from public.canned_responses r
    where r.id = p_response_id for update;
  if not found then
    raise exception 'Response not found' using errcode = 'P0002';
  end if;

  -- Admins may edit *shared* responses from other people. They cannot read,
  -- edit or change the visibility of anybody else's private responses.
  if v_row.owner_id <> p_actor_id
    and not (v_role = 'admin' and v_row.visibility = 'shared') then
    raise exception 'Response not owned by actor' using errcode = '42501';
  end if;

  select s.name into v_shortcut_name from public.shortcuts s
    where s.id = v_row.shortcut_id;
  if v_shortcut_name is null then
    raise exception 'Shortcut missing' using errcode = 'P0002';
  end if;

  -- When changing Shared -> Private as admin, the private shortcut MUST be
  -- owned by the *original creator*, not the admin performing the move.
  -- This keeps the private reply hidden from the administrator after moving.
  if v_row.visibility = p_visibility
    and pg_catalog.lower(v_shortcut_name) = pg_catalog.lower(p_shortcut) then
    v_shortcut_id := v_row.shortcut_id;
  else
    insert into public.shortcuts(name, visibility, owner_id)
    values(p_shortcut, p_visibility, v_row.owner_id)
    on conflict do nothing;

    select s.id into v_shortcut_id from public.shortcuts s
    where s.name_key = pg_catalog.lower(p_shortcut)
      and s.visibility = p_visibility
      and (p_visibility = 'shared' or s.owner_id = v_row.owner_id)
    limit 1;
    if v_shortcut_id is null then
      raise exception 'Could not resolve target shortcut' using errcode = '22023';
    end if;
  end if;

  update public.canned_responses r
     set body = p_body, shortcut_id = v_shortcut_id, visibility = p_visibility
   where r.id = v_row.id
   returning r.* into v_result;

  -- The existing sync_shared_response_feed trigger synchronizes the anonymous\n  -- feed on both visibility transitions.
  return pg_catalog.to_jsonb(v_result);
end;
$$;

revoke all on function public.update_archive_response(uuid,uuid,text,text,text)
from public, anon, authenticated;
grant execute on function public.update_archive_response(uuid,uuid,text,text,text)
to service_role;

-- One atomic deletion per bounded batch; no partial authorization or deletes.
-- Caller must be owner, except an admin may also delete another user's
-- shared replies. An admin can never bulk-delete another user's private text.
create function public.delete_archive_responses_batch(
  p_actor_id uuid,
  p_ids uuid[]
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_role text;
  v_requested integer;
  v_found integer;
  v_forbidden integer;
  v_deleted integer;
begin
  v_requested := pg_catalog.cardinality(p_ids);
  if p_ids is null or v_requested not between 1 and 100
    or (select pg_catalog.count(distinct x) from pg_catalog.unnest(p_ids) x)
       <> v_requested then
    raise exception 'Provide 1 to 100 distinct IDs' using errcode = '22023';
  end if;

  select a.role into v_role from public.agents a
  where a.id = p_actor_id and a.disabled_at is null;
  if v_role is null then
    raise exception 'Account unavailable' using errcode = '42501';
  end if;

  -- Take consistent row locks before checking any permissions, and before
  -- changing any data. This avoids concurrent visibility-change races.
  perform 1 from public.canned_responses r
    where r.id = any(p_ids) order by r.id for update;
  select pg_catalog.count(*),
         pg_catalog.count(*) filter (
           where r.owner_id <> p_actor_id
             and not (v_role = 'admin' and r.visibility = 'shared')
         ) into v_found, v_forbidden
    from public.canned_responses r where r.id = any(p_ids);
  if v_found <> v_requested then
    raise exception 'One or more responses were removed' using errcode = 'P0002';
  end if;
  if v_forbidden <> 0 then
    raise exception 'Cannot delete another user private response'
      using errcode = '42501';
  end if;

  delete from public.canned_responses r where r.id = any(p_ids);
  get diagnostics v_deleted = row_count;
  if v_deleted <> v_requested then
    raise exception 'Deletion count changed' using errcode = 'P0002';
  end if;
  return pg_catalog.jsonb_build_object('deleted',v_deleted);
end;
$$;

revoke all on function public.delete_archive_responses_batch(uuid,uuid[])
from public, anon, authenticated;
grant execute on function public.delete_archive_responses_batch(uuid,uuid[])
to service_role;

-- Administrator-only, transactional agent deletion.
-- The Worker verifies a live session and the database rechecks the actor.
-- Preserve shared shortcuts when other agents still use them.
create function public.admin_delete_agent(
  p_actor_id uuid,
  p_target_id uuid,
  p_confirm_agent_name text
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  v_actor_role text;
  v_target public.agents%rowtype;
  v_deleted_responses integer := 0;
  v_transferred_shortcuts integer := 0;
begin
  if p_actor_id is null or p_target_id is null or p_actor_id = p_target_id then
    raise exception 'Cannot delete your own account' using errcode = '42501';
  end if;

  select a.role into v_actor_role
    from public.agents a
   where a.id = p_actor_id and a.disabled_at is null
   for update;
  if v_actor_role is distinct from 'admin' then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  select a.* into v_target from public.agents a
   where a.id = p_target_id for update;
  if not found then
    raise exception 'Agent not found' using errcode = 'P0002';
  end if;
  if v_target.role = 'admin' then
    raise exception 'Administrator accounts cannot be deleted' using errcode = '42501';
  end if;
  if p_confirm_agent_name is distinct from v_target.agent_name then
    raise exception 'Agent name confirmation does not match' using errcode = '22023';
  end if;

  -- Triggers remove shared-feed entries for the deleted owner's replies.
  delete from public.canned_responses r where r.owner_id = p_target_id;
  get diagnostics v_deleted_responses = row_count;

  -- Remove empty owned shortcuts, including private shortcuts; an empty
  -- shared shortcut need not be retained.
  delete from public.shortcuts s where s.owner_id = p_target_id
    and not exists (select 1 from public.canned_responses r where r.shortcut_id = s.id);

  -- Shared shortcuts still used by OTHER agents remain valid. Give their
  -- ownership to the administrator rather than deleting others' replies.
  update public.shortcuts s set owner_id = p_actor_id
   where s.owner_id = p_target_id and s.visibility = 'shared';
  get diagnostics v_transferred_shortcuts = row_count;

  -- Cascades revoke credentials, sessions and OTP challenges immediately.
  delete from public.agents a where a.id = p_target_id;
  if not found then
    raise exception 'Agent changed while deleting' using errcode = 'P0002';
  end if;

  return pg_catalog.jsonb_build_object(
    'deleted', true,
    'deleted_responses', v_deleted_responses,
    'preserved_shared_shortcuts', v_transferred_shortcuts
  );
end;
$$;

revoke all on function public.admin_delete_agent(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.admin_delete_agent(uuid,uuid,text)
  to service_role;

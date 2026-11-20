
create or replace function public.register_agent(p_agent_name text, p_pin_hash text)
returns table(id uuid, agent_name text, role text)
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_name text; v_role text;
begin
 if p_agent_name is null or p_agent_name <> btrim(p_agent_name)
 or char_length(p_agent_name) not between 2 and 48
 or p_pin_hash is null or char_length(p_pin_hash)<32 then
 raise exception 'Invalid signup data' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(11022026,1);
 if exists(select 1 from public.admin_claim) then v_role:='agent';
 else v_role:='admin'; end if;
 insert into public.agents(agent_name,role) values(p_agent_name,v_role)
 returning public.agents.id, public.agents.agent_name into v_id,v_name;
 insert into public.agent_credentials(agent_id,pin_hash) values(v_id,p_pin_hash);
 if v_role='admin' then insert into public.admin_claim(admin_agent_id) values(v_id); end if;
 return query select v_id,v_name,v_role;
end;
$$;
revoke all on function public.register_agent(text,text) from public,anon,authenticated;
grant execute on function public.register_agent(text,text) to service_role;
create table public.request_rate_limits (
key_hash text primary key check(key_hash ~ '^[0-9a-f]{64}$'),
attempts integer not null default 0 check(attempts>=0),
reset_at timestamptz not null
);
create index request_rate_limits_reset_at_idx on public.request_rate_limits(reset_at);
alter table public.request_rate_limits enable row level security;
revoke all on public.request_rate_limits from public,anon,authenticated;
grant all on public.request_rate_limits to service_role;
create function public.use_rate_limit(p_key_hash text,p_limit integer,p_window_seconds integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_attempts integer;
begin
if p_key_hash !~ '^[0-9a-f]{64}$' or p_limit not between 1 and 10000
 or p_window_seconds not between 60 and 86400 then
 raise exception 'Invalid rate limit parameters' using errcode='22023'; end if;
insert into public.request_rate_limits(key_hash,attempts,reset_at)
values(p_key_hash,1,now()+make_interval(secs=>p_window_seconds))
on conflict (key_hash) do update set
attempts=case when public.request_rate_limits.reset_at<=now() then 1
 else public.request_rate_limits.attempts+1 end,
reset_at=case when public.request_rate_limits.reset_at<=now()
 then now()+make_interval(secs=>p_window_seconds)
 else public.request_rate_limits.reset_at end
returning attempts into v_attempts;
return v_attempts<=p_limit;
end;
$$;
revoke all on function public.use_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.use_rate_limit(text,integer,integer) to service_role;
alter table public.shared_response_feed add column created_by_name text not null default '';
update public.shared_response_feed f set created_by_name=a.agent_name
from public.canned_responses r,public.agents a
where r.id=f.response_id and a.id=r.owner_id;
create or replace function app_internal.sync_shared_response_feed()
returns trigger language plpgsql security definer set search_path='' as $$
begin
if tg_op='DELETE' then
 if old.visibility='shared' then delete from public.shared_response_feed where response_id=old.id; end if;
 return old;
end if;
if tg_op='UPDATE' and old.visibility='shared' and new.visibility<>'shared' then
 delete from public.shared_response_feed where response_id=old.id;
end if;
if new.visibility='shared' then
 insert into public.shared_response_feed(response_id,shortcut_name,body,created_by_name,created_at,updated_at)
 select new.id,s.name,new.body,a.agent_name,new.created_at,new.updated_at
 from public.shortcuts s join public.agents a on a.id=new.owner_id
 where s.id=new.shortcut_id and s.visibility='shared'
 on conflict(response_id) do update set
 shortcut_name=excluded.shortcut_name,body=excluded.body,
 created_by_name=excluded.created_by_name,updated_at=excluded.updated_at;
end if;
return new;
end;
$$;
create function app_internal.sync_creator_name()
returns trigger language plpgsql security definer set search_path='' as $$
begin
if new.agent_name is distinct from old.agent_name then
 update public.shared_response_feed f
 set created_by_name=new.agent_name,updated_at=now()
 where exists(select 1 from public.canned_responses r
 where r.id=f.response_id and r.owner_id=new.id and r.visibility='shared');
end if;
return new;
end;
$$;
create trigger sync_creator_name after update of agent_name on public.agents
for each row execute function app_internal.sync_creator_name();
create function public.admin_agent_stats()
returns table(id uuid,agent_name text,role text,joined_at timestamptz,shared_count bigint,private_count bigint)
language sql stable security invoker set search_path='' as $$
select a.id,a.agent_name,a.role,a.created_at,
 count(r.id) filter(where r.visibility='shared'),
 count(r.id) filter(where r.visibility='private')
from public.agents a left join public.canned_responses r on r.owner_id=a.id
group by a.id,a.agent_name,a.role,a.created_at order by a.created_at;
$$;
revoke all on function public.admin_agent_stats() from public,anon,authenticated;
grant execute on function public.admin_agent_stats() to service_role;
revoke all on function app_internal.sync_creator_name() from public,anon,authenticated;


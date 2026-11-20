
-- OTP consumption and account changes are performed in one database transaction.
-- Only the server-side service role can call this function.
create function public.complete_archive_otp(
  p_challenge_id uuid,
  p_code_hash text,
  p_actor_id uuid default null,
  p_new_pin_hash text default null
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_challenge public.otp_challenges%rowtype;
  v_signup public.pending_signups%rowtype;
  v_agent_id uuid;
  v_role text;
  v_purpose text;
begin
  if p_challenge_id is null or p_code_hash is null
    or p_code_hash !~ '^[0-9a-f]{64}$' then
    return pg_catalog.jsonb_build_object('ok',false);
  end if;

  select * into v_challenge from public.otp_challenges
  where id=p_challenge_id for update;

  if not found
    or v_challenge.consumed_at is not null
    or v_challenge.expires_at <= pg_catalog.now()
    or v_challenge.attempts >= 5 then
    return pg_catalog.jsonb_build_object('ok',false);
  end if;
  if v_challenge.code_hash <> p_code_hash then
    update public.otp_challenges set attempts=attempts+1 where id=p_challenge_id;
    return pg_catalog.jsonb_build_object('ok',false);
  end if;

  v_purpose := v_challenge.purpose;

  if v_purpose='signup' then
    if p_actor_id is not null or p_new_pin_hash is not null then
      return pg_catalog.jsonb_build_object('ok',false);
    end if;
    select * into v_signup from public.pending_signups
    where id=v_challenge.pending_signup_id for update;
    if not found or v_signup.expires_at<=pg_catalog.now()
      or pg_catalog.lower(v_signup.email)<>pg_catalog.lower(v_challenge.target_email) then
      return pg_catalog.jsonb_build_object('ok',false);
    end if;
    perform pg_catalog.pg_advisory_xact_lock(11022026,1);
    if exists(select 1 from public.admin_claim) then v_role:='agent';
    else v_role:='admin'; end if;

    insert into public.agents(agent_name,email,email_verified_at,role)
    values(v_signup.agent_name,pg_catalog.lower(v_signup.email),pg_catalog.now(),v_role)
    returning id into v_agent_id;

    insert into public.agent_credentials(agent_id,pin_hash)
    values(v_agent_id,v_signup.pin_hash);

    if v_role='admin' then
      insert into public.admin_claim(admin_agent_id) values(v_agent_id);
    end if;

    -- Deleting the pending signup also removes its verified challenge.
    delete from public.pending_signups where id=v_signup.id;

    return pg_catalog.jsonb_build_object('ok',true,'action','signup',
      'agent_id',v_agent_id,'role',v_role);
  end if;

  if v_purpose in ('add_email','change_email') then
    if p_actor_id is null or p_actor_id<>v_challenge.agent_id
      or p_new_pin_hash is not null then
      return pg_catalog.jsonb_build_object('ok',false);
    end if;
    update public.agents set email=pg_catalog.lower(v_challenge.target_email),
      email_verified_at=pg_catalog.now()
    where id=p_actor_id and disabled_at is null;
    if not found then return pg_catalog.jsonb_build_object('ok',false); end if;
    update public.otp_challenges set consumed_at=pg_catalog.now()
    where agent_id=p_actor_id and purpose in ('add_email','change_email')
      and consumed_at is null;
    return pg_catalog.jsonb_build_object('ok',true,'action','email');
  end if;

  if v_purpose='recover_pin' then
    if p_actor_id is not null or p_new_pin_hash is null
      or pg_catalog.char_length(p_new_pin_hash)<32 then
      return pg_catalog.jsonb_build_object('ok',false);
    end if;
    -- Recovery applies only to the account currently owning the verified address.
    if not exists(select 1 from public.agents
       where id=v_challenge.agent_id and email_verified_at is not null
       and pg_catalog.lower(email)=pg_catalog.lower(v_challenge.target_email)
       and disabled_at is null) then
       return pg_catalog.jsonb_build_object('ok',false);
    end if;
    update public.agent_credentials
      set pin_hash=p_new_pin_hash, failed_attempts=0,
          locked_until=null, changed_at=pg_catalog.now()
    where agent_id=v_challenge.agent_id;
    if not found then return pg_catalog.jsonb_build_object('ok',false); end if;

    update public.agent_sessions set revoked_at=pg_catalog.now()
    where agent_id=v_challenge.agent_id and revoked_at is null;
    update public.otp_challenges set consumed_at=pg_catalog.now()
    where agent_id=v_challenge.agent_id and purpose='recover_pin'
      and consumed_at is null;

    return pg_catalog.jsonb_build_object('ok',true,'action','recover_pin');
  end if;
  return pg_catalog.jsonb_build_object('ok',false);
end;
$$;
revoke all on function public.complete_archive_otp(uuid,text,uuid,text)
from public,anon,authenticated;
grant execute on function public.complete_archive_otp(uuid,text,uuid,text)
to service_role;


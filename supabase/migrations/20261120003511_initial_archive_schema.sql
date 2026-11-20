
-- Canned Response Archive development schema, initial version.
-- All writes and private reads are reserved for the Cloudflare Worker (service role).
create schema if not exists app_internal;
revoke all on schema app_internal from public, anon, authenticated;

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  agent_name_key text generated always as (lower(btrim(agent_name))) stored,
  email text,
  email_verified_at timestamptz,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  constraint agent_name_valid check (
    agent_name = btrim(agent_name) and char_length(agent_name) between 2 and 48
  ),
  constraint agent_email_valid check (
    email is null or (email = btrim(email) and position('@' in email) > 1)
  ),
  constraint verified_email_consistent check (
    (email is null and email_verified_at is null)
    or (email is not null and email_verified_at is not null)
  ),
  constraint agent_name_unique unique (agent_name_key)
);
create unique index unique_verified_agent_email on public.agents (lower(email))
  where email is not null;
create unique index at_most_one_admin on public.agents ((true))
  where role = 'admin';

create table public.admin_claim (
  singleton boolean primary key default true check (singleton),
  admin_agent_id uuid not null unique references public.agents(id) on delete restrict,
  claimed_at timestamptz not null default now()
);

create table public.agent_credentials (
  agent_id uuid primary key references public.agents(id) on delete cascade,
  pin_hash text not null check (char_length(pin_hash) >= 32),
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  changed_at timestamptz not null default now()
);

create table public.agent_sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  constraint session_expiry_valid check (expires_at > created_at)
);
create index agent_sessions_agent_id_idx on public.agent_sessions(agent_id);
create index agent_sessions_expiry_idx on public.agent_sessions(expires_at);

-- Email signups remain pending until the OTP is verified.
-- No-email signups can be committed immediately through the future backend flow.
create table public.pending_signups (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null check (agent_name = btrim(agent_name) and char_length(agent_name) between 2 and 48),
  email text not null check (email = btrim(email) and position('@' in email) > 1),
  pin_hash text not null check (char_length(pin_hash) >= 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint pending_signup_expiry_valid check (expires_at > created_at)
);
create index pending_signups_expiry_idx on public.pending_signups(expires_at);

create table public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('signup','recover_pin','change_email','add_email')),
  agent_id uuid references public.agents(id) on delete cascade,
  pending_signup_id uuid references public.pending_signups(id) on delete cascade,
  target_email text not null check (target_email = btrim(target_email) and position('@' in target_email) > 1),
  code_hash text not null check (char_length(code_hash) >= 32),
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint otp_expiry_valid check (expires_at > created_at),
  constraint otp_target_valid check (
    (purpose = 'signup' and pending_signup_id is not null and agent_id is null)
    or (purpose <> 'signup' and agent_id is not null and pending_signup_id is null)
  )
);
create index otp_by_agent_idx on public.otp_challenges(agent_id,created_at desc);
create index otp_by_pending_signup_idx on public.otp_challenges(pending_signup_id);
create index otp_expiry_idx on public.otp_challenges(expires_at);

-- A shortcut is shared globally or private to its owner.
-- Shared and private collections can have the same label.
create table public.shortcuts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_key text generated always as (lower(name)) stored,
  visibility text not null check (visibility in ('shared','private')),
  owner_id uuid not null references public.agents(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shortcut_name_valid check (name ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$'),
  constraint shortcut_id_scope_unique unique (id,visibility)
);
create unique index shared_shortcut_name_unique on public.shortcuts(name_key)
  where visibility = 'shared';
create unique index private_shortcut_name_unique on public.shortcuts(owner_id,name_key)
  where visibility = 'private';

create table public.canned_responses (
  id uuid primary key default gen_random_uuid(),
  shortcut_id uuid not null,
  visibility text not null check (visibility in ('shared','private')),
  owner_id uuid not null references public.agents(id) on delete restrict,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint response_matches_shortcut_scope foreign key (shortcut_id,visibility)
    references public.shortcuts(id,visibility) on update restrict on delete restrict
);
create index responses_by_shortcut_idx on public.canned_responses(shortcut_id,created_at);
create index responses_by_owner_idx on public.canned_responses(owner_id,visibility);

-- Deliberately contains only explicitly shared content.
create table public.shared_response_feed (
  response_id uuid primary key references public.canned_responses(id) on delete cascade,
  shortcut_name text not null,
  body text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index shared_feed_shortcut_idx on public.shared_response_feed(lower(shortcut_name));

create function app_internal.touch_updated_at()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger agents_updated_at before update on public.agents
for each row execute function app_internal.touch_updated_at();
create trigger shortcuts_updated_at before update on public.shortcuts
for each row execute function app_internal.touch_updated_at();
create trigger canned_responses_updated_at before update on public.canned_responses
for each row execute function app_internal.touch_updated_at();

-- Private response ownership must match the owner of its private shortcut.
create function app_internal.enforce_private_response_owner()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare
  actual_owner uuid;
begin
  if new.visibility = 'private' then
    select s.owner_id into actual_owner
    from public.shortcuts s
    where s.id = new.shortcut_id and s.visibility = 'private';
    if actual_owner is null or actual_owner <> new.owner_id then
      raise exception 'Private response owner must match shortcut owner'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger enforce_private_response_owner
before insert or update of shortcut_id, visibility, owner_id
on public.canned_responses
for each row execute function app_internal.enforce_private_response_owner();

-- Only shared rows are copied to the guest-readable feed.
create function app_internal.sync_shared_response_feed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.visibility = 'shared' then
      delete from public.shared_response_feed where response_id = old.id;
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.visibility = 'shared' and new.visibility <> 'shared' then
    delete from public.shared_response_feed where response_id = old.id;
  end if;
  if new.visibility = 'shared' then
    insert into public.shared_response_feed(response_id,shortcut_name,body,created_at,updated_at)
    select new.id,s.name,new.body,new.created_at,new.updated_at
    from public.shortcuts s where s.id = new.shortcut_id and s.visibility = 'shared'
    on conflict (response_id) do update set
      shortcut_name = excluded.shortcut_name,
      body = excluded.body,
      updated_at = excluded.updated_at;
  end if;
  return new;
end;
$$;
create trigger sync_shared_response_feed
after insert or update or delete on public.canned_responses
for each row execute function app_internal.sync_shared_response_feed();

create function app_internal.sync_shared_shortcut_name()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.visibility = 'shared' and new.name is distinct from old.name then
    update public.shared_response_feed
    set shortcut_name = new.name, updated_at = now()
    where response_id in (
      select r.id from public.canned_responses r where r.shortcut_id = new.id and r.visibility = 'shared'
    );
  end if;
  return new;
end;
$$;
create trigger sync_shared_shortcut_name
after update of name on public.shortcuts
for each row execute function app_internal.sync_shared_shortcut_name();

-- RLS: direct Data API access to accounts, credentials, private content,
-- shortcuts and canonical responses is denied to all browser roles.
alter table public.agents enable row level security;
alter table public.admin_claim enable row level security;
alter table public.agent_credentials enable row level security;
alter table public.agent_sessions enable row level security;
alter table public.pending_signups enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.shortcuts enable row level security;
alter table public.canned_responses enable row level security;
alter table public.shared_response_feed enable row level security;

revoke all on
  public.agents, public.admin_claim, public.agent_credentials, public.agent_sessions,
  public.pending_signups, public.otp_challenges, public.shortcuts,
  public.canned_responses, public.shared_response_feed
from public, anon, authenticated;
grant select on public.shared_response_feed to anon, authenticated;
create policy "Guest and user read shared response feed"
on public.shared_response_feed for select to anon, authenticated using (true);

grant all on
  public.agents, public.admin_claim, public.agent_credentials, public.agent_sessions,
  public.pending_signups, public.otp_challenges, public.shortcuts,
  public.canned_responses, public.shared_response_feed
to service_role;

revoke all on all functions in schema app_internal from public, anon, authenticated;
revoke execute on all functions in schema app_internal from public;

-- Feed is the ONLY application table in the realtime publication.
alter publication supabase_realtime add table public.shared_response_feed;


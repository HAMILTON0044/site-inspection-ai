create type public.user_role as enum ('INSPECTOR', 'MANAGER');
create type public.project_status as enum ('ACTIVE', 'ARCHIVED');

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  role public.user_role not null default 'INSPECTOR',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 150),
  code text not null unique check (char_length(trim(code)) between 1 and 50),
  description text not null default '',
  status public.project_status not null default 'ACTIVE',
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by uuid not null references public.profiles (id),
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index project_members_user_id_idx
  on public.project_members (user_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger projects_set_updated_at
before update on public.projects
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    'INSPECTOR'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active = true
  );
$$;

create or replace function private.is_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'MANAGER'
      and is_active = true
  );
$$;

create or replace function private.user_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select project_id
  from public.project_members
  where user_id = (select auth.uid())
    and (select private.is_active_user())
$$;

create or replace function private.shares_project_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_members as current_membership
    join public.project_members as target_membership
      on target_membership.project_id = current_membership.project_id
    where current_membership.user_id = (select auth.uid())
      and target_membership.user_id = target_user_id
      and (select private.is_active_user())
  );
$$;

revoke execute on all functions in schema private from public;
revoke execute on all functions in schema private from anon;
grant execute on function private.is_active_user() to authenticated;
grant execute on function private.is_manager() to authenticated;
grant execute on function private.user_project_ids() to authenticated;
grant execute on function private.shares_project_with(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;

revoke all on public.profiles from anon;
revoke all on public.projects from anon;
revoke all on public.project_members from anon;

revoke all on public.profiles from authenticated;
revoke all on public.projects from authenticated;
revoke all on public.project_members from authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

grant select, insert on public.projects to authenticated;
grant update (name, code, description, status) on public.projects to authenticated;

grant select, insert, delete on public.project_members to authenticated;

create policy "profiles_select_allowed_users"
on public.profiles
for select
to authenticated
using (
  (select private.is_active_user())
  and (
    id = (select auth.uid())
    or (select private.is_manager())
    or (select private.shares_project_with(id))
  )
);

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (
  (select private.is_active_user())
  and id = (select auth.uid())
)
with check (
  (select private.is_active_user())
  and id = (select auth.uid())
);

create policy "projects_select_manager_or_member"
on public.projects
for select
to authenticated
using (
  (select private.is_manager())
  or id in (select private.user_project_ids())
);

create policy "projects_insert_manager"
on public.projects
for insert
to authenticated
with check (
  (select private.is_manager())
  and created_by = (select auth.uid())
);

create policy "projects_update_manager"
on public.projects
for update
to authenticated
using ((select private.is_manager()))
with check ((select private.is_manager()));

create policy "project_members_select_manager_or_member"
on public.project_members
for select
to authenticated
using (
  (select private.is_manager())
  or project_id in (select private.user_project_ids())
);

create policy "project_members_insert_manager"
on public.project_members
for insert
to authenticated
with check (
  (select private.is_manager())
  and added_by = (select auth.uid())
);

create policy "project_members_delete_manager"
on public.project_members
for delete
to authenticated
using ((select private.is_manager()));

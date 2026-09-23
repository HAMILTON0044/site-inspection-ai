create type public.inspection_status as enum (
  'DRAFT',
  'SUBMITTED',
  'ARCHIVED'
);

create type public.finding_category as enum (
  'BLOCKED_ACCESS',
  'UNSAFE_CABLE',
  'MISSING_PPE',
  'IMPROPER_STORAGE'
);

create type public.risk_level as enum (
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
  'UNCONFIRMED'
);

create type public.finding_origin as enum ('AI', 'HUMAN');

create type public.finding_status as enum (
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'AWAITING_VERIFICATION',
  'CLOSED',
  'REOPENED'
);

create type public.finding_event_type as enum (
  'CREATED',
  'ASSIGNED',
  'STATUS_CHANGED',
  'COMMENT_ADDED',
  'EVIDENCE_ADDED',
  'RISK_CHANGED',
  'DUE_DATE_CHANGED',
  'REOPENED',
  'CLOSED'
);

create type public.report_format as enum ('PDF', 'DOCX');

create type public.ppe_label as enum (
  'Hardhat',
  'Mask',
  'NO-Hardhat',
  'NO-Mask',
  'NO-Safety Vest',
  'Person',
  'Safety Cone',
  'Safety Vest',
  'machinery',
  'vehicle'
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id),
  inspection_number text not null
    check (char_length(trim(inspection_number)) between 1 and 50),
  created_by uuid not null references public.profiles (id),
  location text not null
    check (char_length(trim(location)) between 1 and 300),
  note text not null default ''
    check (char_length(note) <= 5000),
  summary text not null default ''
    check (char_length(summary) <= 5000),
  status public.inspection_status not null default 'DRAFT',
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, inspection_number),
  check (
    (status = 'DRAFT' and submitted_at is null)
    or (status <> 'DRAFT' and submitted_at is not null)
  )
);

create index inspections_project_status_idx
  on public.inspections (project_id, status, created_at desc);
create index inspections_created_by_idx
  on public.inspections (created_by, created_at desc);

create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null
    references public.inspections (id) on delete cascade,
  storage_key text not null unique
    check (char_length(trim(storage_key)) between 1 and 1000),
  original_file_name text not null
    check (char_length(trim(original_file_name)) between 1 and 255),
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null
    check (size_bytes > 0 and size_bytes <= 10485760),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index inspection_photos_inspection_id_idx
  on public.inspection_photos (inspection_id, created_at);

create table public.vision_detections (
  id uuid primary key default gen_random_uuid(),
  inspection_photo_id uuid not null
    references public.inspection_photos (id) on delete cascade,
  client_detection_id text not null
    check (char_length(trim(client_detection_id)) between 1 and 1000),
  model_name text not null
    check (char_length(trim(model_name)) between 1 and 100),
  model_version text not null
    check (char_length(trim(model_version)) between 1 and 100),
  label public.ppe_label not null,
  confidence double precision not null
    check (confidence >= 0 and confidence <= 1),
  box_x double precision not null check (box_x >= 0),
  box_y double precision not null check (box_y >= 0),
  box_width double precision not null check (box_width > 0),
  box_height double precision not null check (box_height > 0),
  excluded_by_user boolean not null default false,
  created_at timestamptz not null default now(),
  unique (inspection_photo_id, client_detection_id)
);

create index vision_detections_photo_id_idx
  on public.vision_detections (inspection_photo_id);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null
    references public.inspections (id) on delete cascade,
  category public.finding_category not null,
  title text not null check (char_length(trim(title)) between 1 and 300),
  description text not null check (char_length(trim(description)) between 1 and 5000),
  visible_evidence text not null
    check (char_length(trim(visible_evidence)) between 1 and 5000),
  risk_level public.risk_level not null,
  corrective_action text not null
    check (char_length(trim(corrective_action)) between 1 and 5000),
  uncertainty text[] not null default '{}',
  origin public.finding_origin not null,
  modified_by_human boolean not null default false,
  status public.finding_status not null default 'OPEN',
  assignee_id uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles (id) on delete set null,
  check (
    (status = 'OPEN' and assignee_id is null)
    or (status <> 'OPEN' and assignee_id is not null)
  ),
  check (
    (status = 'CLOSED' and closed_at is not null and closed_by is not null)
    or (status <> 'CLOSED' and closed_at is null and closed_by is null)
  )
);

create index findings_inspection_id_idx
  on public.findings (inspection_id, created_at);
create index findings_status_due_at_idx
  on public.findings (status, due_at);
create index findings_assignee_id_idx
  on public.findings (assignee_id, status);

create table public.finding_evidence (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings (id) on delete cascade,
  inspection_photo_id uuid not null
    references public.inspection_photos (id) on delete cascade,
  vision_detection_id uuid
    references public.vision_detections (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index finding_evidence_detection_unique_idx
  on public.finding_evidence (finding_id, vision_detection_id)
  where vision_detection_id is not null;
create unique index finding_evidence_photo_unique_idx
  on public.finding_evidence (finding_id, inspection_photo_id)
  where vision_detection_id is null;
create index finding_evidence_photo_id_idx
  on public.finding_evidence (inspection_photo_id);

create table public.finding_events (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings (id) on delete cascade,
  actor_id uuid not null references public.profiles (id),
  event_type public.finding_event_type not null,
  from_status public.finding_status,
  to_status public.finding_status,
  comment text check (comment is null or char_length(comment) <= 5000),
  created_at timestamptz not null default now()
);

create index finding_events_finding_id_idx
  on public.finding_events (finding_id, created_at);

create table public.finding_follow_ups (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.findings (id) on delete cascade,
  author_id uuid not null references public.profiles (id),
  comment text not null check (char_length(trim(comment)) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index finding_follow_ups_finding_id_idx
  on public.finding_follow_ups (finding_id, created_at);

create table public.follow_up_photos (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null
    references public.finding_follow_ups (id) on delete cascade,
  storage_key text not null unique
    check (char_length(trim(storage_key)) between 1 and 1000),
  original_file_name text not null
    check (char_length(trim(original_file_name)) between 1 and 255),
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null
    check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

create index follow_up_photos_follow_up_id_idx
  on public.follow_up_photos (follow_up_id, created_at);

create table public.generated_reports (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null
    references public.inspections (id) on delete cascade,
  format public.report_format not null,
  storage_key text not null unique
    check (char_length(trim(storage_key)) between 1 and 1000),
  generated_by uuid not null references public.profiles (id),
  generated_at timestamptz not null default now()
);

create index generated_reports_inspection_id_idx
  on public.generated_reports (inspection_id, generated_at desc);

create trigger inspections_set_updated_at
before update on public.inspections
for each row execute function private.set_updated_at();

create trigger findings_set_updated_at
before update on public.findings
for each row execute function private.set_updated_at();

create or replace function private.can_view_inspection(target_inspection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inspections as inspection
    where inspection.id = target_inspection_id
      and (select private.is_active_user())
      and (
        (
          inspection.status = 'DRAFT'
          and inspection.created_by = (select auth.uid())
        )
        or (
          inspection.status <> 'DRAFT'
          and (
            (select private.is_manager())
            or inspection.project_id in (select private.user_project_ids())
          )
        )
      )
  );
$$;

create or replace function private.can_edit_inspection_draft(
  target_inspection_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inspections as inspection
    where inspection.id = target_inspection_id
      and inspection.status = 'DRAFT'
      and inspection.created_by = (select auth.uid())
      and inspection.project_id in (select private.user_project_ids())
      and (select private.is_active_user())
  );
$$;

create or replace function private.can_view_finding(target_finding_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.findings as finding
    where finding.id = target_finding_id
      and (select private.can_view_inspection(finding.inspection_id))
  );
$$;

create or replace function private.can_follow_up_finding(
  target_finding_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.findings as finding
    join public.inspections as inspection
      on inspection.id = finding.inspection_id
    where finding.id = target_finding_id
      and inspection.status <> 'DRAFT'
      and finding.status <> 'CLOSED'
      and (select private.can_view_inspection(inspection.id))
  );
$$;

create or replace function private.validate_finding_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  finding_inspection_id uuid;
  photo_inspection_id uuid;
  detection_photo_id uuid;
begin
  select inspection_id into finding_inspection_id
  from public.findings
  where id = new.finding_id;

  select inspection_id into photo_inspection_id
  from public.inspection_photos
  where id = new.inspection_photo_id;

  if finding_inspection_id is null
    or photo_inspection_id is null
    or finding_inspection_id <> photo_inspection_id then
    raise exception 'Finding evidence must reference the same inspection';
  end if;

  if new.vision_detection_id is not null then
    select inspection_photo_id into detection_photo_id
    from public.vision_detections
    where id = new.vision_detection_id;

    if detection_photo_id is null
      or detection_photo_id <> new.inspection_photo_id then
      raise exception 'Detection evidence must reference the selected photo';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.record_finding_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.finding_events (
    finding_id,
    actor_id,
    event_type,
    to_status
  )
  values (
    new.id,
    new.created_by,
    'CREATED',
    new.status
  );

  return new;
end;
$$;

create trigger finding_evidence_validate_references
before insert or update on public.finding_evidence
for each row execute function private.validate_finding_evidence();

create trigger findings_record_created
after insert on public.findings
for each row execute function private.record_finding_created();

create or replace function private.storage_path_uuid(
  object_name text,
  part_index integer
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  part text;
begin
  part := (storage.foldername(object_name))[part_index];

  if part is null
    or part !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  return part::uuid;
end;
$$;

create or replace function private.storage_path_matches_inspection(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inspections as inspection
    where inspection.id = private.storage_path_uuid(object_name, 2)
      and inspection.project_id = private.storage_path_uuid(object_name, 1)
      and (select private.can_view_inspection(inspection.id))
  );
$$;

create or replace function private.can_upload_inspection_object(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inspections as inspection
    where inspection.id = private.storage_path_uuid(object_name, 2)
      and inspection.project_id = private.storage_path_uuid(object_name, 1)
      and (
        (
          (storage.foldername(object_name))[3] = 'photos'
          and (select private.can_edit_inspection_draft(inspection.id))
        )
        or (
          (storage.foldername(object_name))[3] = 'follow-ups'
          and inspection.status <> 'DRAFT'
          and (select private.can_view_inspection(inspection.id))
        )
      )
  );
$$;

create or replace function private.can_delete_inspection_object(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.inspections as inspection
    where inspection.id = private.storage_path_uuid(object_name, 2)
      and inspection.project_id = private.storage_path_uuid(object_name, 1)
      and (storage.foldername(object_name))[3] = 'photos'
      and (select private.can_edit_inspection_draft(inspection.id))
  );
$$;

revoke execute on function private.can_view_inspection(uuid) from public;
revoke execute on function private.can_edit_inspection_draft(uuid) from public;
revoke execute on function private.can_view_finding(uuid) from public;
revoke execute on function private.can_follow_up_finding(uuid) from public;
revoke execute on function private.validate_finding_evidence() from public;
revoke execute on function private.record_finding_created() from public;
revoke execute on function private.storage_path_uuid(text, integer) from public;
revoke execute on function private.storage_path_matches_inspection(text) from public;
revoke execute on function private.can_upload_inspection_object(text) from public;
revoke execute on function private.can_delete_inspection_object(text) from public;

grant execute on function private.can_view_inspection(uuid) to authenticated;
grant execute on function private.can_edit_inspection_draft(uuid) to authenticated;
grant execute on function private.can_view_finding(uuid) to authenticated;
grant execute on function private.can_follow_up_finding(uuid) to authenticated;
grant execute on function private.storage_path_matches_inspection(text) to authenticated;
grant execute on function private.can_upload_inspection_object(text) to authenticated;
grant execute on function private.can_delete_inspection_object(text) to authenticated;

alter table public.inspections enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.vision_detections enable row level security;
alter table public.findings enable row level security;
alter table public.finding_evidence enable row level security;
alter table public.finding_events enable row level security;
alter table public.finding_follow_ups enable row level security;
alter table public.follow_up_photos enable row level security;
alter table public.generated_reports enable row level security;

revoke all on public.inspections from anon, authenticated;
revoke all on public.inspection_photos from anon, authenticated;
revoke all on public.vision_detections from anon, authenticated;
revoke all on public.findings from anon, authenticated;
revoke all on public.finding_evidence from anon, authenticated;
revoke all on public.finding_events from anon, authenticated;
revoke all on public.finding_follow_ups from anon, authenticated;
revoke all on public.follow_up_photos from anon, authenticated;
revoke all on public.generated_reports from anon, authenticated;

grant select, insert on public.inspections to authenticated;
grant update (inspection_number, location, note, summary)
  on public.inspections to authenticated;

grant select, insert, delete on public.inspection_photos to authenticated;
grant select, insert, delete on public.vision_detections to authenticated;
grant update (excluded_by_user) on public.vision_detections to authenticated;
grant select, insert, delete on public.findings to authenticated;
grant update (
  category,
  title,
  description,
  visible_evidence,
  risk_level,
  corrective_action,
  uncertainty,
  origin,
  modified_by_human
) on public.findings to authenticated;
grant select, insert, delete on public.finding_evidence to authenticated;
grant select on public.finding_events to authenticated;
grant select, insert on public.finding_follow_ups to authenticated;
grant select, insert on public.follow_up_photos to authenticated;
grant select, insert on public.generated_reports to authenticated;

create policy "inspections_select_allowed"
on public.inspections
for select
to authenticated
using ((select private.can_view_inspection(id)));

create policy "inspections_insert_member_draft"
on public.inspections
for insert
to authenticated
with check (
  (select private.is_active_user())
  and created_by = (select auth.uid())
  and status = 'DRAFT'
  and submitted_at is null
  and project_id in (select private.user_project_ids())
);

create policy "inspections_update_own_draft"
on public.inspections
for update
to authenticated
using ((select private.can_edit_inspection_draft(id)))
with check ((select private.can_edit_inspection_draft(id)));

create policy "inspection_photos_select_allowed"
on public.inspection_photos
for select
to authenticated
using ((select private.can_view_inspection(inspection_id)));

create policy "inspection_photos_insert_own_draft"
on public.inspection_photos
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select private.can_edit_inspection_draft(inspection_id))
);

create policy "inspection_photos_delete_own_draft"
on public.inspection_photos
for delete
to authenticated
using ((select private.can_edit_inspection_draft(inspection_id)));

create policy "vision_detections_select_allowed"
on public.vision_detections
for select
to authenticated
using (
  exists (
    select 1
    from public.inspection_photos as photo
    where photo.id = inspection_photo_id
      and (select private.can_view_inspection(photo.inspection_id))
  )
);

create policy "vision_detections_insert_own_draft"
on public.vision_detections
for insert
to authenticated
with check (
  exists (
    select 1
    from public.inspection_photos as photo
    where photo.id = inspection_photo_id
      and (select private.can_edit_inspection_draft(photo.inspection_id))
  )
);

create policy "vision_detections_update_own_draft"
on public.vision_detections
for update
to authenticated
using (
  exists (
    select 1
    from public.inspection_photos as photo
    where photo.id = inspection_photo_id
      and (select private.can_edit_inspection_draft(photo.inspection_id))
  )
)
with check (
  exists (
    select 1
    from public.inspection_photos as photo
    where photo.id = inspection_photo_id
      and (select private.can_edit_inspection_draft(photo.inspection_id))
  )
);

create policy "vision_detections_delete_own_draft"
on public.vision_detections
for delete
to authenticated
using (
  exists (
    select 1
    from public.inspection_photos as photo
    where photo.id = inspection_photo_id
      and (select private.can_edit_inspection_draft(photo.inspection_id))
  )
);

create policy "findings_select_allowed"
on public.findings
for select
to authenticated
using ((select private.can_view_inspection(inspection_id)));

create policy "findings_insert_own_draft"
on public.findings
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status = 'OPEN'
  and assignee_id is null
  and due_at is null
  and closed_at is null
  and closed_by is null
  and (select private.can_edit_inspection_draft(inspection_id))
);

create policy "findings_update_own_draft"
on public.findings
for update
to authenticated
using ((select private.can_edit_inspection_draft(inspection_id)))
with check ((select private.can_edit_inspection_draft(inspection_id)));

create policy "findings_delete_own_draft"
on public.findings
for delete
to authenticated
using ((select private.can_edit_inspection_draft(inspection_id)));

create policy "finding_evidence_select_allowed"
on public.finding_evidence
for select
to authenticated
using ((select private.can_view_finding(finding_id)));

create policy "finding_evidence_insert_own_draft"
on public.finding_evidence
for insert
to authenticated
with check (
  exists (
    select 1
    from public.findings as finding
    where finding.id = finding_id
      and (select private.can_edit_inspection_draft(finding.inspection_id))
  )
);

create policy "finding_evidence_delete_own_draft"
on public.finding_evidence
for delete
to authenticated
using (
  exists (
    select 1
    from public.findings as finding
    where finding.id = finding_id
      and (select private.can_edit_inspection_draft(finding.inspection_id))
  )
);

create policy "finding_events_select_allowed"
on public.finding_events
for select
to authenticated
using ((select private.can_view_finding(finding_id)));

create policy "finding_follow_ups_select_allowed"
on public.finding_follow_ups
for select
to authenticated
using ((select private.can_view_finding(finding_id)));

create policy "finding_follow_ups_insert_project_member"
on public.finding_follow_ups
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (select private.can_follow_up_finding(finding_id))
);

create policy "follow_up_photos_select_allowed"
on public.follow_up_photos
for select
to authenticated
using (
  exists (
    select 1
    from public.finding_follow_ups as follow_up
    where follow_up.id = follow_up_id
      and (select private.can_view_finding(follow_up.finding_id))
  )
);

create policy "follow_up_photos_insert_own_follow_up"
on public.follow_up_photos
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1
    from public.finding_follow_ups as follow_up
    where follow_up.id = follow_up_id
      and follow_up.author_id = (select auth.uid())
      and (select private.can_follow_up_finding(follow_up.finding_id))
  )
);

create policy "generated_reports_select_allowed"
on public.generated_reports
for select
to authenticated
using ((select private.can_view_inspection(inspection_id)));

create policy "generated_reports_insert_allowed"
on public.generated_reports
for insert
to authenticated
with check (
  generated_by = (select auth.uid())
  and exists (
    select 1
    from public.inspections as inspection
    where inspection.id = inspection_id
      and inspection.status <> 'DRAFT'
      and (select private.can_view_inspection(inspection.id))
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'inspection-photos',
  'inspection-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'inspection-reports',
  'inspection-reports',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "inspection_photos_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'inspection-photos'
  and (select private.storage_path_matches_inspection(name))
);

create policy "inspection_photos_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'inspection-photos'
  and owner_id = (select auth.uid()::text)
  and (select private.can_upload_inspection_object(name))
);

create policy "inspection_photos_storage_delete_draft"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inspection-photos'
  and owner_id = (select auth.uid()::text)
  and (select private.can_delete_inspection_object(name))
);

create policy "inspection_reports_storage_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'inspection-reports'
  and (select private.storage_path_matches_inspection(name))
);

create policy "inspection_reports_storage_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'inspection-reports'
  and owner_id = (select auth.uid()::text)
  and (storage.foldername(name))[3] = 'reports'
  and (select private.storage_path_matches_inspection(name))
);

-- Close direct-write bypasses and make report/finding recovery operations atomic.

revoke insert on public.finding_follow_ups from authenticated;
revoke insert on public.follow_up_photos from authenticated;
drop policy if exists "finding_follow_ups_insert_project_member"
  on public.finding_follow_ups;
drop policy if exists "follow_up_photos_insert_own_follow_up"
  on public.follow_up_photos;

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
          and array_length(storage.foldername(object_name), 1) = 3
          and (select private.can_edit_inspection_draft(inspection.id))
        )
        or (
          (storage.foldername(object_name))[3] = 'follow-ups'
          and array_length(storage.foldername(object_name), 1) = 5
          and exists (
            select 1
            from public.findings as finding
            where finding.id = private.storage_path_uuid(object_name, 4)
              and finding.inspection_id = inspection.id
              and finding.status <> 'CLOSED'
              and (
                (select private.is_manager())
                or finding.assignee_id = (select auth.uid())
              )
          )
        )
      )
  );
$$;

create or replace function public.add_assigned_finding_follow_up(
  target_finding_id uuid,
  target_follow_up_id uuid,
  follow_up_comment text,
  photo_payload jsonb default '[]'::jsonb,
  submit_for_verification boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or not (select private.is_active_user()) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.findings as finding
    join public.inspections as inspection
      on inspection.id = finding.inspection_id
    where finding.id = target_finding_id
      and inspection.status <> 'DRAFT'
      and finding.status <> 'CLOSED'
      and (select private.can_view_inspection(inspection.id))
      and (
        (select private.is_manager())
        or finding.assignee_id = actor_id
      )
  ) then
    raise exception 'Only the assignee or an active manager can add follow-up evidence'
      using errcode = '42501';
  end if;

  perform public.add_finding_follow_up(
    target_finding_id,
    target_follow_up_id,
    follow_up_comment,
    photo_payload,
    submit_for_verification
  );
end;
$$;

revoke execute on function public.add_finding_follow_up(
  uuid, uuid, text, jsonb, boolean
) from authenticated;
revoke execute on function public.add_assigned_finding_follow_up(
  uuid, uuid, text, jsonb, boolean
) from public, anon;
grant execute on function public.add_assigned_finding_follow_up(
  uuid, uuid, text, jsonb, boolean
) to authenticated;

create or replace function public.reopen_finding(
  target_finding_id uuid,
  action_comment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_status public.finding_status;
  normalized_comment text := nullif(trim(action_comment), '');
begin
  if actor_id is null or not (select private.is_manager()) then
    raise exception 'Only an active manager can reopen a finding'
      using errcode = '42501';
  end if;

  if normalized_comment is null then
    raise exception 'Reopening a finding requires a comment'
      using errcode = '22023';
  end if;

  select finding.status
  into current_status
  from public.findings as finding
  join public.inspections as inspection
    on inspection.id = finding.inspection_id
  where finding.id = target_finding_id
    and inspection.status <> 'DRAFT'
    and finding.assignee_id is not null
  for update of finding;

  if current_status is null then
    raise exception 'Finding not found or unavailable'
      using errcode = 'P0002';
  end if;

  if current_status not in ('AWAITING_VERIFICATION', 'CLOSED') then
    raise exception 'Only a finding awaiting verification or already closed can be reopened'
      using errcode = '22023';
  end if;

  update public.findings
  set status = 'REOPENED',
      closed_at = null,
      closed_by = null
  where id = target_finding_id;

  insert into public.finding_events (
    finding_id,
    actor_id,
    event_type,
    from_status,
    to_status,
    comment
  )
  values (
    target_finding_id,
    actor_id,
    'REOPENED',
    current_status,
    'REOPENED',
    normalized_comment
  );
end;
$$;

revoke execute on function public.reopen_finding(uuid, text)
  from public, anon;
grant execute on function public.reopen_finding(uuid, text)
  to authenticated;

revoke insert on public.generated_reports from authenticated;
drop policy if exists "generated_reports_insert_allowed"
  on public.generated_reports;

create or replace function public.archive_generated_report(
  target_inspection_id uuid,
  target_storage_key text,
  target_format public.report_format
)
returns table (report_id uuid, report_generated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  project_id uuid;
  inspection_status public.inspection_status;
  required_prefix text;
begin
  if actor_id is null or not (select private.is_active_user()) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select inspection.project_id, inspection.status
  into project_id, inspection_status
  from public.inspections as inspection
  where inspection.id = target_inspection_id
    and inspection.status in ('SUBMITTED', 'ARCHIVED')
    and (select private.can_view_inspection(inspection.id));

  if project_id is null then
    raise exception 'Inspection not found or unavailable'
      using errcode = 'P0002';
  end if;

  required_prefix := project_id::text
    || '/' || target_inspection_id::text || '/reports/';

  if target_format <> 'PDF'
    or target_storage_key not like required_prefix || '%'
    or substring(target_storage_key from char_length(required_prefix) + 1) like '%/%'
    or target_storage_key not like '%.pdf'
    or char_length(target_storage_key) > 1000 then
    raise exception 'Invalid report storage path or format'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'inspection-reports'
      and object.name = target_storage_key
      and object.owner_id = actor_id::text
  ) then
    raise exception 'Report object is missing or not owned by the current user'
      using errcode = '22023';
  end if;

  return query
  insert into public.generated_reports (
    inspection_id,
    format,
    storage_key,
    generated_by
  )
  values (
    target_inspection_id,
    target_format,
    target_storage_key,
    actor_id
  )
  returning id, generated_at;
end;
$$;

revoke execute on function public.archive_generated_report(
  uuid, text, public.report_format
) from public, anon;
grant execute on function public.archive_generated_report(
  uuid, text, public.report_format
) to authenticated;

create or replace function private.can_delete_unlinked_report_object(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (storage.foldername(object_name))[3] = 'reports'
    and array_length(storage.foldername(object_name), 1) = 3
    and (select private.storage_path_matches_inspection(object_name))
    and not exists (
      select 1
      from public.generated_reports
      where storage_key = object_name
    );
$$;

revoke execute on function private.can_delete_unlinked_report_object(text)
  from public, anon;
grant execute on function private.can_delete_unlinked_report_object(text)
  to authenticated;

drop policy if exists "inspection_reports_storage_delete_owner"
  on storage.objects;
create policy "inspection_reports_storage_delete_unlinked_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inspection-reports'
  and owner_id = (select auth.uid()::text)
  and (select private.can_delete_unlinked_report_object(name))
);

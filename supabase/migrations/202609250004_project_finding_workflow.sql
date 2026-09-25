create or replace function public.manage_finding(
  target_finding_id uuid,
  target_assignee_id uuid,
  target_due_at timestamptz,
  target_risk_level public.risk_level,
  action_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_status public.finding_status;
  current_assignee_id uuid;
  current_due_at timestamptz;
  current_risk_level public.risk_level;
  finding_project_id uuid;
  next_status public.finding_status;
  normalized_comment text := nullif(trim(action_comment), '');
begin
  if actor_id is null or not (select private.is_manager()) then
    raise exception 'Only an active manager can manage a finding'
      using errcode = '42501';
  end if;

  select
    finding.status,
    finding.assignee_id,
    finding.due_at,
    finding.risk_level,
    inspection.project_id
  into
    current_status,
    current_assignee_id,
    current_due_at,
    current_risk_level,
    finding_project_id
  from public.findings as finding
  join public.inspections as inspection
    on inspection.id = finding.inspection_id
  where finding.id = target_finding_id
    and inspection.status <> 'DRAFT'
  for update of finding;

  if current_status is null then
    raise exception 'Finding not found or not submitted'
      using errcode = 'P0002';
  end if;

  if current_status = 'CLOSED' then
    raise exception 'Closed findings must be reopened before editing management fields'
      using errcode = '22023';
  end if;

  if target_assignee_id is not null and not exists (
    select 1
    from public.profiles as profile
    join public.project_members as membership
      on membership.user_id = profile.id
    where profile.id = target_assignee_id
      and profile.role = 'INSPECTOR'
      and profile.is_active = true
      and membership.project_id = finding_project_id
  ) then
    raise exception 'Assignee must be an active inspector in the finding project'
      using errcode = '22023';
  end if;

  if current_status <> 'OPEN' and target_assignee_id is null then
    raise exception 'An active finding cannot be left without an assignee'
      using errcode = '22023';
  end if;

  next_status := current_status;
  if current_status = 'OPEN' and target_assignee_id is not null then
    next_status := 'ASSIGNED';
  end if;

  update public.findings
  set assignee_id = target_assignee_id,
      due_at = target_due_at,
      risk_level = target_risk_level,
      status = next_status
  where id = target_finding_id;

  if current_assignee_id is distinct from target_assignee_id then
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
      'ASSIGNED',
      current_status,
      next_status,
      normalized_comment
    );
  end if;

  if current_due_at is distinct from target_due_at then
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
      'DUE_DATE_CHANGED',
      next_status,
      next_status,
      normalized_comment
    );
  end if;

  if current_risk_level is distinct from target_risk_level then
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
      'RISK_CHANGED',
      next_status,
      next_status,
      normalized_comment
    );
  end if;
end;
$$;

create or replace function public.transition_finding_status(
  target_finding_id uuid,
  target_status public.finding_status,
  action_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_manager boolean := (select private.is_manager());
  current_status public.finding_status;
  current_assignee_id uuid;
  current_risk_level public.risk_level;
  normalized_comment text := nullif(trim(action_comment), '');
  transition_allowed boolean := false;
  event_kind public.finding_event_type := 'STATUS_CHANGED';
begin
  if actor_id is null or not (select private.is_active_user()) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select finding.status, finding.assignee_id, finding.risk_level
  into current_status, current_assignee_id, current_risk_level
  from public.findings as finding
  join public.inspections as inspection
    on inspection.id = finding.inspection_id
  where finding.id = target_finding_id
    and inspection.status <> 'DRAFT'
    and (select private.can_view_inspection(inspection.id))
  for update of finding;

  if current_status is null then
    raise exception 'Finding not found or unavailable'
      using errcode = 'P0002';
  end if;

  if current_assignee_id is null then
    raise exception 'Assign the finding before changing its workflow state'
      using errcode = '22023';
  end if;

  if actor_is_manager then
    transition_allowed := (
      (current_status = 'ASSIGNED' and target_status = 'IN_PROGRESS')
      or (current_status = 'IN_PROGRESS' and target_status = 'AWAITING_VERIFICATION')
      or (current_status = 'REOPENED' and target_status = 'IN_PROGRESS')
      or (
        current_status = 'AWAITING_VERIFICATION'
        and target_status in ('CLOSED', 'REOPENED')
      )
    );
  elsif current_assignee_id = actor_id then
    transition_allowed := (
      (current_status = 'ASSIGNED' and target_status = 'IN_PROGRESS')
      or (current_status = 'REOPENED' and target_status = 'IN_PROGRESS')
      or (current_status = 'IN_PROGRESS' and target_status = 'AWAITING_VERIFICATION')
    );
  end if;

  if not transition_allowed then
    raise exception 'This workflow transition is not allowed for the current user'
      using errcode = '42501';
  end if;

  if target_status = 'AWAITING_VERIFICATION' and not exists (
    select 1
    from public.finding_follow_ups
    where finding_id = target_finding_id
  ) then
    raise exception 'Add a corrective follow-up before requesting verification'
      using errcode = '22023';
  end if;

  if target_status in ('CLOSED', 'REOPENED') and normalized_comment is null then
    raise exception 'Verification decisions require a comment'
      using errcode = '22023';
  end if;

  if target_status = 'CLOSED' then
    if not exists (
      select 1
      from public.finding_follow_ups
      where finding_id = target_finding_id
    ) then
      raise exception 'A finding cannot be closed without corrective follow-up'
        using errcode = '22023';
    end if;

    if current_risk_level in ('HIGH', 'CRITICAL') and not exists (
      select 1
      from public.finding_follow_ups as follow_up
      join public.follow_up_photos as photo
        on photo.follow_up_id = follow_up.id
      where follow_up.finding_id = target_finding_id
    ) then
      raise exception 'High-risk findings require corrective photo evidence before closing'
        using errcode = '22023';
    end if;
  end if;

  if target_status = 'CLOSED' then
    update public.findings
    set status = target_status,
        closed_at = now(),
        closed_by = actor_id
    where id = target_finding_id;
    event_kind := 'CLOSED';
  else
    update public.findings
    set status = target_status,
        closed_at = null,
        closed_by = null
    where id = target_finding_id;

    if target_status = 'REOPENED' then
      event_kind := 'REOPENED';
    end if;
  end if;

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
    event_kind,
    current_status,
    target_status,
    normalized_comment
  );
end;
$$;

create or replace function public.add_finding_follow_up(
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
  actor_is_manager boolean := (select private.is_manager());
  current_status public.finding_status;
  current_assignee_id uuid;
  finding_inspection_id uuid;
  finding_project_id uuid;
  normalized_comment text := trim(follow_up_comment);
  photo_item jsonb;
  photo_id uuid;
  photo_key text;
  photo_name text;
  photo_mime text;
  photo_size bigint;
  required_prefix text;
begin
  if actor_id is null or not (select private.is_active_user()) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(normalized_comment) < 1 or char_length(normalized_comment) > 5000 then
    raise exception 'Follow-up comment must contain 1 to 5000 characters'
      using errcode = '22023';
  end if;

  if jsonb_typeof(photo_payload) <> 'array' or jsonb_array_length(photo_payload) > 5 then
    raise exception 'Follow-up photos must be an array with at most 5 items'
      using errcode = '22023';
  end if;

  select
    finding.status,
    finding.assignee_id,
    inspection.id,
    inspection.project_id
  into
    current_status,
    current_assignee_id,
    finding_inspection_id,
    finding_project_id
  from public.findings as finding
  join public.inspections as inspection
    on inspection.id = finding.inspection_id
  where finding.id = target_finding_id
    and inspection.status <> 'DRAFT'
    and (select private.can_follow_up_finding(finding.id))
  for update of finding;

  if current_status is null then
    raise exception 'Finding not found, closed, or unavailable'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.finding_follow_ups where id = target_follow_up_id
  ) then
    raise exception 'Follow-up ID already exists' using errcode = '23505';
  end if;

  if submit_for_verification then
    if current_status <> 'IN_PROGRESS' then
      raise exception 'Only an in-progress finding can be submitted for verification'
        using errcode = '22023';
    end if;

    if not actor_is_manager and current_assignee_id is distinct from actor_id then
      raise exception 'Only the assignee or a manager can request verification'
        using errcode = '42501';
    end if;
  end if;

  required_prefix := finding_project_id::text
    || '/' || finding_inspection_id::text
    || '/follow-ups/' || target_finding_id::text
    || '/' || target_follow_up_id::text || '/';

  for photo_item in select value from jsonb_array_elements(photo_payload)
  loop
    begin
      photo_id := (photo_item ->> 'id')::uuid;
      photo_size := (photo_item ->> 'size_bytes')::bigint;
    exception when others then
      raise exception 'Invalid follow-up photo metadata' using errcode = '22023';
    end;

    photo_key := trim(photo_item ->> 'storage_key');
    photo_name := trim(photo_item ->> 'original_file_name');
    photo_mime := trim(photo_item ->> 'mime_type');

    if photo_key is null
      or photo_key not like required_prefix || '%'
      or char_length(photo_key) > 1000
      or photo_name is null
      or char_length(photo_name) < 1
      or char_length(photo_name) > 255
      or photo_mime not in ('image/jpeg', 'image/png', 'image/webp')
      or photo_size < 1
      or photo_size > 10485760 then
      raise exception 'Invalid follow-up photo metadata' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'inspection-photos'
        and object.name = photo_key
        and object.owner_id = actor_id::text
    ) then
      raise exception 'Follow-up photo object is missing or not owned by the current user'
        using errcode = '22023';
    end if;
  end loop;

  insert into public.finding_follow_ups (
    id,
    finding_id,
    author_id,
    comment
  )
  values (
    target_follow_up_id,
    target_finding_id,
    actor_id,
    normalized_comment
  );

  for photo_item in select value from jsonb_array_elements(photo_payload)
  loop
    insert into public.follow_up_photos (
      id,
      follow_up_id,
      storage_key,
      original_file_name,
      mime_type,
      size_bytes,
      uploaded_by
    )
    values (
      (photo_item ->> 'id')::uuid,
      target_follow_up_id,
      trim(photo_item ->> 'storage_key'),
      trim(photo_item ->> 'original_file_name'),
      trim(photo_item ->> 'mime_type'),
      (photo_item ->> 'size_bytes')::bigint,
      actor_id
    );
  end loop;

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
    'COMMENT_ADDED',
    current_status,
    current_status,
    normalized_comment
  );

  if jsonb_array_length(photo_payload) > 0 then
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
      'EVIDENCE_ADDED',
      current_status,
      current_status,
      jsonb_array_length(photo_payload)::text || ' corrective photo(s) added'
    );
  end if;

  if submit_for_verification then
    update public.findings
    set status = 'AWAITING_VERIFICATION'
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
      'STATUS_CHANGED',
      current_status,
      'AWAITING_VERIFICATION',
      'Submitted corrective work for manager verification'
    );
  end if;
end;
$$;

create or replace function private.can_delete_unlinked_follow_up_object(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (storage.foldername(object_name))[3] = 'follow-ups'
    and not exists (
      select 1
      from public.follow_up_photos
      where storage_key = object_name
    );
$$;

revoke execute on function public.manage_finding(
  uuid,
  uuid,
  timestamptz,
  public.risk_level,
  text
) from public, anon;
revoke execute on function public.transition_finding_status(
  uuid,
  public.finding_status,
  text
) from public, anon;
revoke execute on function public.add_finding_follow_up(
  uuid,
  uuid,
  text,
  jsonb,
  boolean
) from public, anon;
revoke execute on function private.can_delete_unlinked_follow_up_object(text)
  from public, anon;

grant execute on function public.manage_finding(
  uuid,
  uuid,
  timestamptz,
  public.risk_level,
  text
) to authenticated;
grant execute on function public.transition_finding_status(
  uuid,
  public.finding_status,
  text
) to authenticated;
grant execute on function public.add_finding_follow_up(
  uuid,
  uuid,
  text,
  jsonb,
  boolean
) to authenticated;
grant execute on function private.can_delete_unlinked_follow_up_object(text)
  to authenticated;

create policy "follow_up_photos_storage_delete_unlinked_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inspection-photos'
  and owner_id = (select auth.uid()::text)
  and (select private.can_delete_unlinked_follow_up_object(name))
);

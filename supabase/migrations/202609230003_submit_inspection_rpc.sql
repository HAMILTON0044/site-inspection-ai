create or replace function public.submit_inspection_draft(
  target_inspection_id uuid,
  payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  photo_item jsonb;
  detection_item jsonb;
  finding_item jsonb;
  evidence_item jsonb;
  photo_id uuid;
  finding_id uuid;
  evidence_detection_id uuid;
  uncertainty_values text[];
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'Submission payload must be a JSON object';
  end if;

  if jsonb_typeof(payload -> 'photos') <> 'array'
    or jsonb_typeof(payload -> 'findings') <> 'array' then
    raise exception 'Submission payload must contain photos and findings arrays';
  end if;

  if jsonb_array_length(payload -> 'photos') < 1
    or jsonb_array_length(payload -> 'photos') > 10 then
    raise exception 'An inspection must contain between 1 and 10 photos';
  end if;

  if jsonb_array_length(payload -> 'findings') > 100 then
    raise exception 'An inspection cannot contain more than 100 findings';
  end if;

  if not private.can_edit_inspection_draft(target_inspection_id) then
    raise exception 'Inspection draft is unavailable or cannot be edited';
  end if;

  for photo_item in
    select value from jsonb_array_elements(payload -> 'photos')
  loop
    if jsonb_typeof(photo_item -> 'detections') <> 'array' then
      raise exception 'Each photo must contain a detections array';
    end if;

    if jsonb_array_length(photo_item -> 'detections') > 100 then
      raise exception 'A photo cannot contain more than 100 detections';
    end if;

    photo_id := (photo_item ->> 'id')::uuid;

    if not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'inspection-photos'
        and object.name = photo_item ->> 'storage_key'
        and object.owner_id = current_user_id::text
    ) then
      raise exception 'Uploaded photo object is missing or has the wrong owner';
    end if;

    insert into public.inspection_photos (
      id,
      inspection_id,
      storage_key,
      original_file_name,
      mime_type,
      size_bytes,
      width,
      height,
      sha256,
      uploaded_by
    )
    values (
      photo_id,
      target_inspection_id,
      photo_item ->> 'storage_key',
      photo_item ->> 'original_file_name',
      photo_item ->> 'mime_type',
      (photo_item ->> 'size_bytes')::bigint,
      (photo_item ->> 'width')::integer,
      (photo_item ->> 'height')::integer,
      photo_item ->> 'sha256',
      current_user_id
    );

    for detection_item in
      select value from jsonb_array_elements(photo_item -> 'detections')
    loop
      insert into public.vision_detections (
        id,
        inspection_photo_id,
        client_detection_id,
        model_name,
        model_version,
        label,
        confidence,
        box_x,
        box_y,
        box_width,
        box_height,
        excluded_by_user
      )
      values (
        (detection_item ->> 'id')::uuid,
        photo_id,
        detection_item ->> 'client_detection_id',
        detection_item ->> 'model_name',
        detection_item ->> 'model_version',
        (detection_item ->> 'label')::public.ppe_label,
        (detection_item ->> 'confidence')::double precision,
        (detection_item ->> 'box_x')::double precision,
        (detection_item ->> 'box_y')::double precision,
        (detection_item ->> 'box_width')::double precision,
        (detection_item ->> 'box_height')::double precision,
        coalesce((detection_item ->> 'excluded_by_user')::boolean, false)
      );
    end loop;
  end loop;

  for finding_item in
    select value from jsonb_array_elements(payload -> 'findings')
  loop
    if jsonb_typeof(finding_item -> 'uncertainty') <> 'array'
      or jsonb_typeof(finding_item -> 'evidence') <> 'array' then
      raise exception 'Each finding must contain uncertainty and evidence arrays';
    end if;

    finding_id := (finding_item ->> 'id')::uuid;

    select coalesce(array_agg(value), array[]::text[])
    into uncertainty_values
    from jsonb_array_elements_text(finding_item -> 'uncertainty');

    insert into public.findings (
      id,
      inspection_id,
      category,
      title,
      description,
      visible_evidence,
      risk_level,
      corrective_action,
      uncertainty,
      origin,
      modified_by_human,
      status,
      created_by
    )
    values (
      finding_id,
      target_inspection_id,
      (finding_item ->> 'category')::public.finding_category,
      finding_item ->> 'title',
      finding_item ->> 'description',
      finding_item ->> 'visible_evidence',
      (finding_item ->> 'risk_level')::public.risk_level,
      finding_item ->> 'corrective_action',
      uncertainty_values,
      (finding_item ->> 'origin')::public.finding_origin,
      coalesce((finding_item ->> 'modified_by_human')::boolean, false),
      'OPEN',
      current_user_id
    );

    for evidence_item in
      select value from jsonb_array_elements(finding_item -> 'evidence')
    loop
      evidence_detection_id := nullif(
        evidence_item ->> 'detection_id',
        ''
      )::uuid;

      insert into public.finding_evidence (
        finding_id,
        inspection_photo_id,
        vision_detection_id
      )
      values (
        finding_id,
        (evidence_item ->> 'photo_id')::uuid,
        evidence_detection_id
      );
    end loop;
  end loop;

  update public.inspections
  set status = 'SUBMITTED',
      submitted_at = now()
  where id = target_inspection_id
    and status = 'DRAFT'
    and created_by = current_user_id;

  if not found then
    raise exception 'Inspection draft could not be submitted';
  end if;

  return target_inspection_id;
end;
$$;

create or replace function public.abort_inspection_draft(
  target_inspection_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  delete from public.inspections
  where id = target_inspection_id
    and status = 'DRAFT'
    and created_by = auth.uid()
    and private.can_edit_inspection_draft(id)
  returning true into deleted;

  return coalesce(deleted, false);
end;
$$;

revoke all on function public.submit_inspection_draft(uuid, jsonb)
  from public, anon;
revoke all on function public.abort_inspection_draft(uuid)
  from public, anon;

grant execute on function public.submit_inspection_draft(uuid, jsonb)
  to authenticated;
grant execute on function public.abort_inspection_draft(uuid)
  to authenticated;

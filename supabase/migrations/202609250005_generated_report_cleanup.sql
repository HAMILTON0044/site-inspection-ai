-- Allow an authenticated owner to remove a report object when metadata insertion fails.
create policy "inspection_reports_storage_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'inspection-reports'
  and owner_id = (select auth.uid()::text)
  and (select private.storage_path_matches_inspection(name))
);

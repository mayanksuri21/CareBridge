-- Allow a rejected doctor to correct details and resubmit. Approval/rejection remains admin-only.
create or replace function public.guard_doctor_verification_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_verification_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      if new.status = 'pending' then raise exception 'administrators may only approve or reject an application'; end if;
      if new.status = 'approved' and (select count(distinct document_type) from public.doctor_verification_documents where application_id = new.id and document_type in ('medical_registration', 'qualification', 'government_id')) <> 3 then raise exception 'a licence, qualification certificate, and government ID are required before approval'; end if;
      new.reviewed_by := auth.uid(); new.reviewed_at := now();
      if new.status = 'approved' then new.rejection_reason := null; end if;
    end if;
    new.updated_at := now(); return new;
  end if;
  if tg_op = 'INSERT' then
    if not public.is_doctor_account() or new.doctor_id <> auth.uid() or new.status <> 'pending' or new.reviewed_by is not null or new.reviewed_at is not null or new.rejection_reason is not null then raise exception 'only a doctor may submit their own pending application'; end if;
  elsif old.doctor_id = auth.uid() and old.status = 'rejected' and new.status = 'pending' and new.reviewed_by is null and new.reviewed_at is null and new.rejection_reason is null then
    new.submitted_at := now();
  elsif old.doctor_id <> auth.uid() or old.status <> 'pending' or new.status <> old.status or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at or new.rejection_reason is distinct from old.rejection_reason then
    raise exception 'only pending application details may be edited';
  end if;
  new.updated_at := now(); return new;
end;
$$;

drop policy if exists "doctor can update own pending verification application" on public.doctor_verification_applications;
create policy "doctor can update or resubmit own verification application" on public.doctor_verification_applications
for update using (doctor_id = auth.uid() and status in ('pending', 'rejected') and public.is_doctor_account())
with check (doctor_id = auth.uid() and status = 'pending' and public.is_doctor_account());

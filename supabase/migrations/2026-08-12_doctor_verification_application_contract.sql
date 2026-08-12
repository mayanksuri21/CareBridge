-- Canonical application fields used by the registration and review workflow.
-- Kept on the existing application table; no parallel verification table is created.

alter table public.doctor_verification_applications
  add column if not exists medical_college text,
  add column if not exists medical_license_number text,
  add column if not exists registration_council text,
  add column if not exists clinic_hospital_name text,
  add column if not exists clinic_hospital_address text,
  add column if not exists license_document_path text,
  add column if not exists degree_document_path text,
  add column if not exists government_id_document_path text,
  add column if not exists supporting_document_path text;

-- Backfill from the earlier field names so installations with existing applications
-- retain their data before the UI starts writing the canonical columns.
update public.doctor_verification_applications
set medical_college = coalesce(medical_college, college_or_university),
    medical_license_number = coalesce(medical_license_number, registration_number),
    registration_council = coalesce(registration_council, registration_authority),
    clinic_hospital_name = coalesce(clinic_hospital_name, current_hospital_or_clinic),
    clinic_hospital_address = coalesce(clinic_hospital_address, address);

create index if not exists doctor_verification_applications_doctor_status_idx
  on public.doctor_verification_applications(doctor_id, status);
create index if not exists doctor_verification_applications_review_queue_idx
  on public.doctor_verification_applications(status, submitted_at asc);

-- Approval requires all three private files to have been uploaded and recorded.
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
      if new.status = 'approved' and (new.license_document_path is null or new.degree_document_path is null or new.government_id_document_path is null) then
        raise exception 'licence, degree, and government ID documents are required before approval';
      end if;
      if new.status = 'rejected' and nullif(trim(new.rejection_reason), '') is null then
        raise exception 'a rejection reason is required';
      end if;
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

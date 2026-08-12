-- Doctor verification hardening. Run after the existing doctor verification migrations.
-- Email confirmation authenticates an account; it never approves a doctor.

alter table public.doctor_verification_applications
  add column if not exists email text;
alter table public.doctor_verification_applications
  add column if not exists professional_bio text;

-- Preserve existing values where available. New submissions provide this value from
-- the authenticated account, so verification reviewers never need auth.users access.
update public.doctor_verification_applications a
set email = p.email
from public.profiles p
where p.id = a.doctor_id and a.email is null;

create or replace function public.is_approved_doctor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.doctor_verification_applications
    where doctor_id = auth.uid() and status = 'approved'
  );
$$;

-- Only the verification trigger may create or activate a doctor row. This prevents
-- a browser client from setting doctors.is_active=true directly.
drop policy if exists "doctor_self_insert" on public.doctors;
drop policy if exists "doctor_self_update" on public.doctors;

-- The generic schema's appointment insert policy allowed a patient to choose any
-- doctor id. Restrict booking to approved doctors only.
drop policy if exists "insert_authenticated" on public.appointments;
create policy "patients book approved doctors" on public.appointments
for insert to authenticated
with check (
  auth.uid() = patient_id
  and exists (
    select 1 from public.doctors d
    join public.doctor_verification_applications a on a.doctor_id = d.id
    where d.id = doctor_id and d.is_active = true and a.status = 'approved'
  )
);

-- A verification admin is the only non-owner that may read applications and files.
-- No policy grants verification-document access to patients or ordinary doctors.
drop policy if exists "admin can review verification applications" on public.doctor_verification_applications;
create policy "admin can review verification applications" on public.doctor_verification_applications
for all to authenticated
using (public.is_verification_admin())
with check (public.is_verification_admin());

drop policy if exists "admin can review verification documents" on public.doctor_verification_documents;
create policy "admin can review verification documents" on public.doctor_verification_documents
for select to authenticated using (public.is_verification_admin());

-- Let admins view application fields through their existing application policy, but
-- do not broaden profiles RLS merely to obtain an email address.

-- Doctor verification is deliberately separate from profiles and doctors:
-- profiles remains the account record and doctors remains the provider record.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_verification_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.is_doctor_account()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'doctor');
$$;

create table if not exists public.doctor_verification_applications (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null,
  date_of_birth date not null,
  gender text,
  phone text not null,
  address text not null,
  city text not null,
  state text not null,
  qualification text not null,
  specialization text not null,
  college_or_university text not null,
  graduation_year integer not null check (graduation_year between 1900 and 2100),
  years_of_experience integer not null check (years_of_experience >= 0 and years_of_experience <= 100),
  current_hospital_or_clinic text,
  registration_number text not null,
  registration_authority text not null,
  registration_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint doctor_verification_review_consistency check (
    (status = 'pending' and reviewed_by is null and reviewed_at is null and rejection_reason is null)
    or (status = 'approved' and reviewed_by is not null and reviewed_at is not null and rejection_reason is null)
    or (status = 'rejected' and reviewed_by is not null and reviewed_at is not null and rejection_reason is not null)
  )
);

create table if not exists public.doctor_verification_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.doctor_verification_applications(id) on delete cascade,
  document_type text not null check (document_type in ('medical_registration', 'government_id', 'qualification', 'other')),
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz not null default now()
);

create index if not exists doctor_verification_applications_status_idx
  on public.doctor_verification_applications(status, submitted_at);
create index if not exists doctor_verification_documents_application_idx
  on public.doctor_verification_documents(application_id);

-- A new provider record cannot be bookable before approval.
alter table public.doctors alter column is_active set default false;
update public.doctors set is_active = false
where not exists (
  select 1 from public.doctor_verification_applications a
  where a.doctor_id = doctors.id and a.status = 'approved'
);

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role / migration operations may provision administrators. Browser users may not.
  if auth.uid() is not null and not public.is_verification_admin() then
    if tg_op = 'INSERT' and new.role = 'admin' then
      raise exception 'admin role cannot be self-assigned';
    end if;
    if tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'account role cannot be changed after registration';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before insert or update on public.profiles
for each row execute function public.protect_profile_role();

create or replace function public.guard_doctor_verification_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_verification_admin() then
    if tg_op = 'UPDATE' and new.status is distinct from old.status then
      if new.status = 'pending' then
        raise exception 'administrators may only approve or reject an application';
      end if;
      if new.status = 'approved' and not exists (
        select 1 from public.doctor_verification_documents
        where application_id = new.id
      ) then
        raise exception 'an application needs at least one verification document before approval';
      end if;
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
      if new.status = 'approved' then new.rejection_reason := null; end if;
    end if;
    new.updated_at := now();
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_doctor_account() or new.doctor_id <> auth.uid()
       or new.status <> 'pending' or new.reviewed_by is not null
       or new.reviewed_at is not null or new.rejection_reason is not null then
      raise exception 'only a doctor may submit their own pending application';
    end if;
  else
    if old.doctor_id <> auth.uid() or old.status <> 'pending'
       or new.status <> old.status or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.rejection_reason is distinct from old.rejection_reason then
      raise exception 'only pending application details may be edited';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.sync_verified_doctor_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.doctors (id, specialty, is_active)
  values (new.doctor_id, new.specialization, new.status = 'approved')
  on conflict (id) do update set
    specialty = excluded.specialty,
    is_active = excluded.is_active;
  return new;
end;
$$;

drop trigger if exists guard_doctor_verification_application on public.doctor_verification_applications;
create trigger guard_doctor_verification_application
before insert or update on public.doctor_verification_applications
for each row execute function public.guard_doctor_verification_application();

drop trigger if exists sync_verified_doctor_activation on public.doctor_verification_applications;
create trigger sync_verified_doctor_activation
after insert or update of status, specialization on public.doctor_verification_applications
for each row execute function public.sync_verified_doctor_activation();

alter table public.admin_users enable row level security;
alter table public.doctor_verification_applications enable row level security;
alter table public.doctor_verification_documents enable row level security;

create policy "admin can view own admin grant" on public.admin_users
for select using (user_id = auth.uid());

create policy "doctor can read own verification application" on public.doctor_verification_applications
for select using (doctor_id = auth.uid() and public.is_doctor_account());
create policy "doctor can submit own verification application" on public.doctor_verification_applications
for insert with check (doctor_id = auth.uid() and public.is_doctor_account() and status = 'pending');
create policy "doctor can update own pending verification application" on public.doctor_verification_applications
for update using (doctor_id = auth.uid() and status = 'pending' and public.is_doctor_account())
with check (doctor_id = auth.uid() and status = 'pending' and public.is_doctor_account());
create policy "admin can review verification applications" on public.doctor_verification_applications
for all using (public.is_verification_admin()) with check (public.is_verification_admin());

create policy "doctor can read own verification documents" on public.doctor_verification_documents
for select using (exists (select 1 from public.doctor_verification_applications a where a.id = application_id and a.doctor_id = auth.uid() and public.is_doctor_account()));
create policy "doctor can add documents to own pending application" on public.doctor_verification_documents
for insert with check (exists (select 1 from public.doctor_verification_applications a where a.id = application_id and a.doctor_id = auth.uid() and a.status = 'pending' and public.is_doctor_account()));
create policy "doctor can remove documents from own pending application" on public.doctor_verification_documents
for delete using (exists (select 1 from public.doctor_verification_applications a where a.id = application_id and a.doctor_id = auth.uid() and a.status = 'pending' and public.is_doctor_account()));
create policy "admin can review verification documents" on public.doctor_verification_documents
for select using (public.is_verification_admin());

-- Private storage: document contents remain in Storage, only references live above.
insert into storage.buckets (id, name, public)
values ('doctor-verification-documents', 'doctor-verification-documents', false)
on conflict (id) do update set public = false;

create policy "doctor uploads own verification files" on storage.objects
for insert to authenticated with check (
  bucket_id = 'doctor-verification-documents'
  and public.is_doctor_account()
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "doctor reads own verification files" on storage.objects
for select to authenticated using (
  bucket_id = 'doctor-verification-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_verification_admin())
);
create policy "doctor deletes own pending verification files" on storage.objects
for delete to authenticated using (
  bucket_id = 'doctor-verification-documents'
  and public.is_doctor_account()
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.doctor_verification_applications a
    where a.doctor_id = auth.uid() and a.status = 'pending'
  )
);

-- Existing self-only doctor policy remains; patients can only discover approved providers.
create policy "patients can read approved doctors" on public.doctors
for select using (is_active = true);
create policy "users can read approved doctor profiles" on public.profiles
for select using (exists (select 1 from public.doctors d where d.id = profiles.id and d.is_active = true));

-- Bootstrap an administrator through the SQL editor or a trusted server only:
-- insert into public.admin_users (user_id) values ('<existing-auth-user-uuid>');

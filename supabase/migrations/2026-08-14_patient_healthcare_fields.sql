-- Add healthcare fields to profiles table
alter table public.profiles
  add column if not exists age integer,
  add column if not exists gender text,
  add column if not exists blood_group text,
  add column if not exists emergency_contact text,
  add column if not exists allergies text,
  add column if not exists doctor_schedules text;

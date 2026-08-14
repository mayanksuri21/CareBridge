-- Alter appointments table check constraint to support 'declined' status value
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check check (status in ('booked', 'completed', 'cancelled', 'declined'));

-- Alter profiles table to add schedule_presets jsonb column
alter table public.profiles add column if not exists schedule_presets jsonb;
alter table public.profiles add column if not exists schedule_config jsonb;

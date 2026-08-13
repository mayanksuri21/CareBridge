alter table public.prescriptions
  add column if not exists doctor_name text,
  add column if not exists diagnosis text,
  add column if not exists medicines jsonb not null default '[]'::jsonb,
  add column if not exists advice text;

create index if not exists prescriptions_patient_created_at_idx
  on public.prescriptions(patient_id, created_at desc);

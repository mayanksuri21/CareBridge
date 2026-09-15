-- Payment Gateway Schema Migration

-- 1. Create payments table
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  patient_id uuid references public.profiles(id) on delete cascade,
  amount numeric not null,
  currency text default 'INR',
  status text default 'created', -- created, paid, failed, refunded
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Add payment_status column to appointments table
alter table public.appointments add column if not exists payment_status text default 'not_required';
-- values: not_required (before window opens), pending (window open, unpaid), paid, expired

-- 3. Add consultation_fee column to doctors table
alter table public.doctors add column if not exists consultation_fee numeric default 500;

-- 4. Enable Row Level Security (RLS) policies
alter table public.payments enable row level security;

drop policy if exists "payments_patient_select" on public.payments;
create policy "payments_patient_select" on public.payments
  for select using (auth.uid() = patient_id);

drop policy if exists "payments_insert_auth" on public.payments;
create policy "payments_insert_auth" on public.payments
  for insert with check (auth.role() = 'authenticated');

drop policy if exists "payments_update_auth" on public.payments;
create policy "payments_update_auth" on public.payments
  for update using (auth.role() = 'authenticated');

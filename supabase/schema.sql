-- Core auth profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  role text check (role in ('patient','doctor','admin')) default 'patient',
  name text,
  email text,
  address text,
  company text,
  portfolio text,
  github text,
  about text,
  avatar_url text,
  specialty text,
  language text default 'en',
  onboarding_completed boolean default false,
  first_login_at timestamptz,
  updated_at timestamptz default now(),
  created_at timestamp with time zone default now()
);

-- Doctors
create table if not exists public.doctors (
  id uuid primary key references public.profiles(id) on delete cascade,
  specialty text,
  languages text[],
  is_active boolean default true
);

-- Doctor schedule slots
create table if not exists public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid references public.doctors(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_booked boolean default false
);

-- Appointments
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.profiles(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  slot_id uuid references public.schedule_slots(id) on delete set null,
  status text check (status in ('booked','completed','cancelled')) default 'booked',
  reason text,
  created_at timestamptz default now()
);

-- Consent
create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  text text,
  accepted boolean default false,
  created_at timestamptz default now()
);

-- Prescriptions
create table if not exists public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  patient_id uuid references public.profiles(id) on delete cascade,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid references public.prescriptions(id) on delete cascade,
  medication_name text,
  dosage text,
  frequency text,
  duration text,
  instructions text
);

-- Pharmacies and inventory
create table if not exists public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text,
  address text,
  phone text,
  lat double precision,
  lng double precision,
  is_open boolean default true
);

create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid references public.pharmacies(id) on delete cascade,
  medication_name text,
  price numeric,
  quantity integer
);

-- Reservations
create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid references public.prescriptions(id) on delete cascade,
  pharmacy_id uuid references public.pharmacies(id) on delete cascade,
  status text check (status in ('reserved','picked','cancelled')) default 'reserved',
  pickup_code text,
  created_at timestamptz default now()
);

-- Audit log
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event text,
  metadata jsonb,
  created_at timestamptz default now()
);

-- RLS policies
alter table public.profiles enable row level security;
alter table public.doctors enable row level security;
alter table public.schedule_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.consents enable row level security;
alter table public.prescriptions enable row level security;
alter table public.prescription_items enable row level security;
alter table public.pharmacies enable row level security;
alter table public.inventory enable row level security;
alter table public.reservations enable row level security;
alter table public.audit_logs enable row level security;

-- Basic policies (liberal for demo, tighten later)
create policy "read_all_public" on public.pharmacies for select using (true);
create policy "read_all_inventory" on public.inventory for select using (true);

create policy "profile_self" on public.profiles for select using (auth.uid() = id);
create policy "profile_insert_self" on public.profiles for insert with check (auth.uid() = id);
create policy "profile_update_self" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Doctors: allow each user to manage their own doctor record (demo)
create policy "doctor_self_select" on public.doctors for select using (auth.uid() = id);
create policy "doctor_self_insert" on public.doctors for insert with check (auth.uid() = id);

-- Appointments: patient or doctor can see their own
create policy "appointments_patient" on public.appointments for select using (auth.uid() = patient_id);
create policy "appointments_doctor" on public.appointments for select using (auth.uid() = doctor_id);

-- Allow inserts by authenticated users (demo)
create policy "insert_authenticated" on public.appointments for insert with check (auth.role() = 'authenticated');
create policy "insert_slots" on public.schedule_slots for insert with check (auth.role() = 'authenticated');

-- You should add more granular policies for production.

-- ============================================================
-- CAREBRIDGE APPOINTMENTS FIX
-- Align database with the actual consultation workflow
-- ============================================================

-- 1. Remove the old status constraint
ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_status_check;

-- 2. Add the columns that the patient booking page already uses.
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS appointment_date date;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS time_slot text;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

-- Optional display fields used by the UI
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS patient_name text;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS patient_email text;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS doctor_name text;

ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS symptoms text;

-- 3. Make pending the default because requests require
-- doctor approval before becoming scheduled.
ALTER TABLE public.appointments
ALTER COLUMN status SET DEFAULT 'pending';

-- 4. Allow all statuses used by the CareBridge workflow.
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check
CHECK (
  status IN (
    'pending',
    'awaiting_approval',
    'scheduled',
    'booked',
    'completed',
    'cancelled',
    'declined'
  )
);

-- 5. Helpful indexes
CREATE INDEX IF NOT EXISTS appointments_patient_id_idx
ON public.appointments(patient_id);

CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx
ON public.appointments(doctor_id);

CREATE INDEX IF NOT EXISTS appointments_status_idx
ON public.appointments(status);

CREATE INDEX IF NOT EXISTS appointments_date_idx
ON public.appointments(appointment_date);

CREATE INDEX IF NOT EXISTS appointments_slot_idx
ON public.appointments(slot_id);
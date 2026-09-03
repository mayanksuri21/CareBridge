-- ============================================================
-- Allow 'in_progress' and 'doctor_in_room' status for appointments
-- ============================================================

ALTER TABLE public.appointments
DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments
ADD CONSTRAINT appointments_status_check
CHECK (
  status IN (
    'pending',
    'awaiting_approval',
    'scheduled',
    'booked',
    'in_progress',
    'doctor_in_room',
    'completed',
    'cancelled',
    'declined'
  )
);

-- Alter appointments table check constraint to support 'pending', 'scheduled', and 'rejected' statuses
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('pending', 'scheduled', 'booked', 'completed', 'cancelled', 'declined', 'rejected'));

-- Add reason_notes column to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS reason_notes TEXT;

-- Set default status to 'pending'
ALTER TABLE public.appointments ALTER COLUMN status SET DEFAULT 'pending';

-- ============================================================
-- Migration: Add date_of_birth to profiles table
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth TEXT;

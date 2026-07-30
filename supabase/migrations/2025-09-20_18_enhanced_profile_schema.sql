-- Enhanced Profile Schema Migration
-- Add additional columns to profiles table

-- First, let's check if columns exist and add them if they don't
DO $$
BEGIN
  -- Add portfolio column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'portfolio') THEN
    ALTER TABLE profiles ADD COLUMN portfolio TEXT;
  END IF;

  -- Add company column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'company') THEN
    ALTER TABLE profiles ADD COLUMN company TEXT;
  END IF;

  -- Add github column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'github') THEN
    ALTER TABLE profiles ADD COLUMN github TEXT;
  END IF;

  -- Add linkedin column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'linkedin') THEN
    ALTER TABLE profiles ADD COLUMN linkedin TEXT;
  END IF;

  -- Add about column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'about') THEN
    ALTER TABLE profiles ADD COLUMN about TEXT;
  END IF;

  -- Add avatar_url column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'avatar_url') THEN
    ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
  END IF;

  -- Add address column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'address') THEN
    ALTER TABLE profiles ADD COLUMN address TEXT;
  END IF;

  -- Add specialty column if it doesn't exist (for doctors)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'specialty') THEN
    ALTER TABLE profiles ADD COLUMN specialty TEXT;
  END IF;

  -- Add doctor_languages column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'doctor_languages') THEN
    ALTER TABLE profiles ADD COLUMN doctor_languages TEXT;
  END IF;
END $$;

-- Create an index on the user ID for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(id);

-- Enable Row Level Security (RLS) if not already enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access their own profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

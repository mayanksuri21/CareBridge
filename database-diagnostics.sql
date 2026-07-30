-- Database diagnostic queries
-- Run these in Supabase SQL Editor to check your database state

-- 1. Check if profiles table exists and what columns it has
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' 
ORDER BY ordinal_position;

-- 2. Check current profile data for your user (replace with actual user ID)
-- SELECT * FROM profiles WHERE id = 'your-user-id-here';

-- 3. Check if there are any RLS policies
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'profiles';

-- 4. Test a simple insert to see if basic functionality works
-- (Don't run this if you already have a profile)
-- INSERT INTO profiles (id, name, email, role) 
-- VALUES ('test-id', 'Test User', 'test@example.com', 'patient')
-- ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 5. Check for any constraints that might be failing
SELECT conname, contype, pg_get_constraintdef(c.oid) as constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE cl.relname = 'profiles' AND n.nspname = 'public';
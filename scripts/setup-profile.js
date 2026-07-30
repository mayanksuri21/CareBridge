#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

console.log('🏥 Setting up Enhanced Profile Page for Telemedicine Platform...')
console.log('')
const migrationScript = `-- Enhanced Profile Schema Migration
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
`
const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
if (!fs.existsSync(migrationsDir)) {
  fs.mkdirSync(migrationsDir, { recursive: true })
}
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                 new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('-')[0]
const migrationFile = path.join(migrationsDir, `${timestamp}_enhanced_profile_schema.sql`)

fs.writeFileSync(migrationFile, migrationScript)

console.log('✅ Created database migration file:')
console.log(`   ${migrationFile}`)
console.log('')
const packageJsonPath = path.join(process.cwd(), 'package.json')
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  
  if (!packageJson.scripts) {
    packageJson.scripts = {}
  }
  
  packageJson.scripts['setup:profile'] = 'node scripts/setup-profile.js'
  packageJson.scripts['db:migrate'] = 'supabase migration up'
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
  console.log('✅ Added scripts to package.json:')
  console.log('   - setup:profile: Setup enhanced profile functionality')
  console.log('   - db:migrate: Run database migrations')
  console.log('')
}
const setupInstructions = `
# Enhanced Profile Page Setup Complete! 🎉

## What was created:

1. ✅ Enhanced Profile Page Component (\`components/profile/enhanced-profile-page.tsx\`)
2. ✅ Image Upload Hook (\`hooks/use-image-upload.ts\`)
3. ✅ Character Limit Hook (\`hooks/use-character-limit.ts\`)
4. ✅ Enhanced Profile API Route (\`app/api/profile/route.ts\`)
5. ✅ Database Migration File (\`supabase/migrations/${timestamp}_enhanced_profile_schema.sql\`)

## Features included:

- 🎨 Beautiful UI matching the reference design with gradient background
- 📸 Profile picture upload with preview
- 📝 Comprehensive profile form with validation
- 🔒 Role-based fields (doctor-specific specialty and languages)
- 📱 Responsive design for all screen sizes
- 🔄 Real-time character counting for bio field
- 🏠 Navigation back to homepage
- 💾 Automatic save/load functionality

## Next steps:

1. **Run the database migration:**
   \`\`\`bash
   pnpm db:migrate
   # or if you have Supabase CLI:
   supabase migration up
   \`\`\`

2. **Test the profile page:**
   - Start your development server: \`pnpm dev\`
   - Log in to your application
   - Navigate to \`/profile\` or click "View Profile" from the homepage
   - Try editing your profile and uploading a picture

3. **Customize the design:**
   - Modify the gradient colors in \`enhanced-profile-page.tsx\`
   - Adjust form fields based on your specific requirements
   - Add additional validation as needed

## Profile Flow:

1. **New User:** After login, they'll be prompted to complete their profile
2. **Existing User:** Can view and edit their profile information
3. **Profile Display:** Shows all information in a clean, organized layout
4. **Edit Mode:** Full-screen dialog with all form fields and image upload

## Database Schema:

The migration adds these fields to your \`profiles\` table:
- \`portfolio\` (TEXT) - User's website/portfolio URL
- \`company\` (TEXT) - User's workplace
- \`github\` (TEXT) - GitHub profile URL
- \`linkedin\` (TEXT) - LinkedIn profile URL
- \`about\` (TEXT) - User bio (max 180 characters)
- \`avatar_url\` (TEXT) - Profile picture URL
- \`address\` (TEXT) - Full address
- \`specialty\` (TEXT) - Medical specialty (for doctors)
- \`doctor_languages\` (TEXT) - Languages spoken (for doctors)

Enjoy your enhanced profile page! 🚀
`

console.log(setupInstructions)
fs.writeFileSync(path.join(process.cwd(), 'PROFILE_SETUP.md'), setupInstructions)
console.log('📚 Created PROFILE_SETUP.md with detailed instructions')
console.log('')
console.log('🚀 Setup complete! Run the database migration and start your dev server to test.')
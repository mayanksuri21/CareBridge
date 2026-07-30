import { createSupabaseBrowserClient } from './client'
import type { Session, User } from '@supabase/supabase-js'

export interface OnboardingStatus {
  isFirstTime: boolean
  onboardingCompleted: boolean
  hasProfile: boolean
  profileCompleteness: number
}
export async function checkOnboardingStatus(user: User): Promise<OnboardingStatus> {
  const supabase = createSupabaseBrowserClient()
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking profile:', error)
      throw error
    }

    const hasProfile = !!profile
    const onboardingCompleted = profile?.onboarding_completed || false
    let profileCompleteness = 0
    if (profile) {
      const requiredFields = ['name', 'phone', 'role'] as const
      const optionalFields = ['email', 'address', 'about', 'avatar_url'] as const
      const roleSpecificFields = profile.role === 'doctor' ? ['specialty'] as const : [] as const
      
      const allFields = [...requiredFields, ...optionalFields, ...roleSpecificFields] as const
      const completedFields = allFields.filter(field => profile[field])
      profileCompleteness = Math.round((completedFields.length / allFields.length) * 100)
    }
    const isFirstTime = !hasProfile || !onboardingCompleted

    return {
      isFirstTime,
      onboardingCompleted,
      hasProfile,
      profileCompleteness
    }
  } catch (error) {
    console.error('Failed to check onboarding status:', error)
    return {
      isFirstTime: true,
      onboardingCompleted: false,
      hasProfile: false,
      profileCompleteness: 0
    }
  }
}
export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  
  try {
    console.log('Marking onboarding as completed for user:', userId)

    const { error } = await supabase
      .from('profiles')
      .update({ 
        onboarding_completed: true,
        first_login_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (error) {
      console.error('Error completing onboarding:', error)
      throw error
    }

    console.log('Onboarding completed successfully')
  } catch (error) {
    console.error('Failed to complete onboarding:', error)
    throw error
  }
}
export async function createInitialProfile(user: User, profileData: {
  name: string
  phone: string
  role: 'patient' | 'doctor'
  address?: string
  specialty?: string
}): Promise<void> {
  const supabase = createSupabaseBrowserClient()
  
  try {
    const profileInsert = {
      id: user.id,
      name: profileData.name,
      email: user.email || '',
      phone: profileData.phone,
      role: profileData.role,
      address: profileData.address || '',
      specialty: profileData.specialty || '',
      language: 'en',
      onboarding_completed: false,
      first_login_at: new Date().toISOString()
    }

    console.log('Creating profile with complete data:', profileInsert)

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profileInsert, {
        onConflict: 'id'
      })

    if (profileError) {
      console.error('Error creating/updating profile:', profileError)
      throw new Error(`Profile creation failed: ${profileError.message}`)
    }

    console.log('Profile created successfully')
  } catch (error) {
    console.error('Failed to create initial profile:', error)
    throw error instanceof Error ? error : new Error('Unknown error occurred during profile creation')
  }
}
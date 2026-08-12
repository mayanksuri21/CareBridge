import { createSupabaseBrowserClient } from './client'

export async function checkUserProfileStatus(userId: string) {
  const supabase = createSupabaseBrowserClient()
  
  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (error && error.code === 'PGRST116') {
      return { hasProfile: false, isComplete: false, profile: null }
    }
    
    if (error) {
      console.error('Error checking profile:', error)
      return { hasProfile: false, isComplete: false, profile: null }
    }
    
    if (!profile) {
      return { hasProfile: false, isComplete: false, profile: null }
    }
    const hasEssentialInfo = !!(profile.name && profile.role)
    
    return { 
      hasProfile: true, 
      isComplete: hasEssentialInfo, 
      profile 
    }
  } catch (error) {
    console.error('Profile status check failed:', error)
    return { hasProfile: false, isComplete: false, profile: null }
  }
}

export async function getPostLoginRedirect(userId: string): Promise<string> {
  const status = await checkUserProfileStatus(userId)
  
  if (!status.hasProfile || !status.isComplete) {
    return '/profile'
  }
  if (status.profile?.role === 'doctor') {
    const supabase = createSupabaseBrowserClient()
    const { data: application } = await supabase
      .from('doctor_verification_applications')
      .select('status')
      .eq('doctor_id', userId)
      .maybeSingle()
    if (application?.status === 'approved') return '/doctor/dashboard'
    if (application?.status === 'rejected') return '/doctor/verification-rejected'
    return application ? '/doctor/verification-pending' : '/doctor-verification'
  }
  return '/'
}

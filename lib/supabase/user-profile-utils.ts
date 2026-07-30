import { createSupabaseBrowserClient } from './client'
import type { User } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  name?: string  
  avatar_url?: string
  role?: string
  created_at?: string
  updated_at?: string
}
export async function getUserProfile(user: User): Promise<UserProfile | null> {
  const supabase = createSupabaseBrowserClient()
  
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, role, created_at, updated_at')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }

    console.log('getUserProfile result:', profile)
    return profile
  } catch (error) {
    console.error('Failed to fetch user profile:', error)
    return null
  }
}
export function getUserDisplayName(user: User, profile?: UserProfile | null): string {
  if (profile?.name) return profile.name
  if (user.user_metadata?.full_name) return user.user_metadata.full_name
  if (user.user_metadata?.name) return user.user_metadata.name
  return user.email || 'User'
}
export function getUserAvatarUrl(profile?: UserProfile | null): string {
  return profile?.avatar_url || '/placeholder-user.jpg'
}
export function getUserInitials(displayName: string): string {
  return displayName
    .split(' ')
    .map(part => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('')
}
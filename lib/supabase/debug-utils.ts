import { createSupabaseBrowserClient } from './client'
export async function testSessionStatus() {
  const supabase = createSupabaseBrowserClient()
  
  try {
    const { data: { session }, error } = await supabase.auth.getSession()
    console.log('Current session status:', {
      hasSession: !!session,
      userId: session?.user?.id,
      email: session?.user?.email,
      error: error?.message
    })
    return { session, error }
  } catch (err) {
    console.error('Session check failed:', err)
    return { session: null, error: err }
  }
}
export async function testLogout() {
  console.log('=== Testing Logout Functionality ===')
  console.log('Before logout:')
  await testSessionStatus()
  
  const supabase = createSupabaseBrowserClient()
  console.log('Performing logout...')
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  
  if (error) {
    console.error('Logout error:', error)
  } else {
    console.log('Logout successful')
  }
  setTimeout(async () => {
    console.log('After logout:')
    await testSessionStatus()
  }, 1000)
}
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).testSessionStatus = testSessionStatus;
  (window as any).testLogout = testLogout;
  console.log('Debug utilities loaded:', {
    testSessionStatus: 'Available as window.testSessionStatus()',
    testLogout: 'Available as window.testLogout()'
  })
}
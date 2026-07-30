import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const role = requestUrl.searchParams.get('role') || 'patient'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            return cookieStore.get(name)?.value
          },
          async set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          async remove(name: string, options: any) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )
    
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && data.user) {
      try {
        const user = data.user
        const profileData = {
          name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          phone: user.user_metadata?.phone_number || '',
          role: role as 'patient' | 'doctor',
          language: 'en'
        }
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin
        const profileResponse = await fetch(`${baseUrl}/api/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.session?.access_token}`
          },
          body: JSON.stringify(profileData)
        })

        if (!profileResponse.ok) {
          console.error('Profile API call failed:', {
            status: profileResponse.status,
            statusText: profileResponse.statusText,
            url: `${baseUrl}/api/profile`
          })
          try {
            const errorText = await profileResponse.text()
            console.error('Profile API error response:', errorText)
          } catch (responseError) {
            console.error('Could not read error response:', responseError)
          }
        } else {
          console.log('Profile created/updated successfully')
        }
        return NextResponse.redirect(`${requestUrl.origin}/`)
        
      } catch (profileError) {
        console.error('Profile creation error:', profileError)
        return NextResponse.redirect(`${requestUrl.origin}/`)
      }
    }
  }
  return NextResponse.redirect(`${requestUrl.origin}/login`)
}
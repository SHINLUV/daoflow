import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { authCookieName } from '@/lib/auth/bff'
import { noStoreHeaders } from '@/lib/auth/http'

/**
 * Supabase Auth 中间件
 * 刷新过期的 session cookie，保持登录态
 */
export async function middleware(request: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return privateNoStore(request, NextResponse.next({ request }))
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: authCookieName() },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 刷新 session（不阻塞请求，静默处理失败）
  await supabase.auth.getUser()

  return privateNoStore(request, supabaseResponse)
}

function privateNoStore(request: NextRequest, response: NextResponse): NextResponse {
  const path = request.nextUrl.pathname
  if (path === '/ask' || path === '/my-dao' || path.startsWith('/auth/') || path.startsWith('/journal')
    || path.startsWith('/api/auth/') || path.startsWith('/api/journal/') || path.startsWith('/api/me/') || path.startsWith('/api/ask')) {
    for (const [name, value] of Object.entries(noStoreHeaders())) response.headers.set(name, value)
  }
  return response
}

export const config = {
  matcher: [
    // 排除静态资源和 API 路由
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

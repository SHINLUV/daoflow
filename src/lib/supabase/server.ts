import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseCookieName } from './storage-key'

/**
 * Supabase 服务端客户端（App Router）
 * 用于 Server Components、Server Actions、Route Handlers
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.SUPABASE_INTERNAL_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://supabase-not-configured.invalid',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'public-anon-key-not-configured',
    {
      cookieOptions: { name: getSupabaseCookieName(process.env.NEXT_PUBLIC_SUPABASE_URL) },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component 中调用 setAll 会抛出异常,
            // 可由 Middleware 刷新过期session来规避
          }
        },
      },
    }
  )
}

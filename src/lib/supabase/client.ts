import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase 浏览器端客户端
 * 用于 Client Components
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

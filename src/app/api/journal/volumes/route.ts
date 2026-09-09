import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { cursorFor, parseCursor, parseJournalSearch, parseLimit, parseVolumeCreate, toVolume } from '@/lib/journal/volumes'

const columns = 'id,title,archived_at,version,created_at,updated_at'
const fail = (status: number, code: string, message: string, requestId: string) => NextResponse.json({ error: { code, message }, requestId }, { status })

async function auth(requestId: string) {
  if (!isSupabaseConfigured) return { response: fail(503, 'SUPABASE_UNAVAILABLE', '私人卷册服务尚未配置。', requestId) }
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? { response: fail(401, 'AUTH_REQUIRED', '请先登录后管理卷册。', requestId) } : { supabase, user }
}

const escape = (query: string) => query.replace(/[\\%_(),.]/g, '\\$&')

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const context = await auth(requestId)
  if ('response' in context) return context.response
  try {
    const search = parseJournalSearch(request.nextUrl.searchParams.get('q'))
    const cursor = parseCursor(request.nextUrl.searchParams.get('cursor'))
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'))
    let query = context.supabase.from('journal_volumes').select(columns).eq('user_id', context.user.id)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1)
    if (search) query = query.ilike('title', `%${escape(search)}%`)
    if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
    const { data, error } = await query
    if (error) return fail(500, 'VOLUMES_READ_FAILED', '暂时无法读取卷册。', requestId)
    const rows = data ?? []
    const counted = await Promise.all(rows.slice(0, limit).map(async row => {
      const result = await context.supabase.from('journal_entries').select('*', { count: 'exact', head: true })
        .eq('user_id', context.user.id).eq('volume_id', row.id).is('deleted_at', null)
      return { row, count: result.count, error: result.error }
    }))
    if (counted.some(result => result.error)) return fail(500, 'VOLUMES_READ_FAILED', '暂时无法统计卷册内容。', requestId)
    const items = counted.map(result => toVolume(result.row, result.count ?? 0))
    const last = items.at(-1)
    return NextResponse.json({ items, nextCursor: rows.length > limit && last ? cursorFor(last.createdAt, last.id) : null })
  } catch (error) {
    return fail(400, 'INVALID_INPUT', error instanceof Error ? error.message : '请求无效。', requestId)
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID()
  const context = await auth(requestId)
  if ('response' in context) return context.response
  try {
    const input = parseVolumeCreate(await request.json())
    const { data, error } = await context.supabase.rpc('create_volume', { p_id: input.id, p_title: input.title })
    if (error) {
      if (error.message.includes('IDEMPOTENCY')) return fail(409, 'IDEMPOTENCY_CONFLICT', '该保存标识已用于另一个卷册。', requestId)
      if (error.message.includes('VOLUME_NOT_FOUND')) return fail(404, 'NOT_FOUND', '卷册不存在或你没有权限访问。', requestId)
      return fail(500, 'VOLUME_CREATE_FAILED', '卷册未能保存。', requestId)
    }
    return NextResponse.json({ volume: toVolume(data, 0) }, { status: 201 })
  } catch (error) {
    return fail(400, 'INVALID_INPUT', error instanceof Error ? error.message : '请求无效。', requestId)
  }
}

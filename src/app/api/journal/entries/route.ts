import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import {
  EntryInputError,
  createPayloadForRpc,
  escapeIlikeTerm,
  makeEntryCursor,
  mapEntry,
  parseCreateEntry,
  parseEntryCursor,
  parseEntryQuery,
  sameCreatePayload,
} from '@/lib/journal/entries'
import type { ApiError } from '@/lib/journal/contracts'

export const dynamic = 'force-dynamic'

function requestId() {
  return crypto.randomUUID()
}

function errorResponse(status: number, code: string, message: string, id: string, extra: Record<string, unknown> = {}) {
  const body: ApiError & Record<string, unknown> = { error: { code, message }, requestId: id, ...extra }
  return NextResponse.json(body, { status })
}

function privateApiUnavailable(id: string) {
  return errorResponse(503, 'SUPABASE_UNAVAILABLE', '私人记录服务尚未配置，请稍后再试。', id)
}

async function currentUser(id: string) {
  if (!isSupabaseConfigured) return { response: privateApiUnavailable(id) }
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { response: errorResponse(401, 'AUTH_REQUIRED', '请先登录后再访问心笺。', id) }
  return { supabase, user }
}

function rpcError(error: { message?: string; code?: string } | null, id: string) {
  const message = error?.message ?? ''
  if (message.includes('AUTH_REQUIRED')) return errorResponse(401, 'AUTH_REQUIRED', '请先登录后再操作。', id)
  if (message.includes('ENTRY_NOT_FOUND') || message.includes('VOLUME_NOT_FOUND')) return errorResponse(404, 'NOT_FOUND', '记录不存在或你没有权限访问。', id)
  if (message.includes('CAS_CONFLICT')) return errorResponse(409, 'VERSION_CONFLICT', '记录已在其他位置更新，请先处理本地草稿。', id)
  if (message.includes('IDEMPOTENCY_CONFLICT')) return errorResponse(409, 'IDEMPOTENCY_CONFLICT', '该保存标识已用于不同内容。', id)
  if (message.includes('ENTRY_RECYCLED') || message.includes('PURGE_REQUIRES_RECYCLED_ENTRY')) return errorResponse(409, 'INVALID_STATE', '该操作不符合记录当前状态。', id)
  if (message.includes('INVALID_')) return errorResponse(400, 'INVALID_INPUT', '提交内容不符合要求。', id)
  return errorResponse(500, 'JOURNAL_WRITE_FAILED', '保存未完成，请保留内容后重试。', id)
}

function invalidRequest(error: unknown, id: string) {
  const message = error instanceof EntryInputError ? error.message : '请求体必须是合法 JSON。'
  return errorResponse(400, 'INVALID_INPUT', message, id)
}

export async function GET(request: NextRequest) {
  const id = requestId()
  const context = await currentUser(id)
  if ('response' in context) return context.response
  try {
    const filter = request.nextUrl.searchParams.get('filter') ?? 'active'
    if (filter !== 'active' && filter !== 'trash') throw new EntryInputError('filter 必须是 active 或 trash。')
    const query = parseEntryQuery(request.nextUrl.searchParams.get('q'))
    const cursor = parseEntryCursor(request.nextUrl.searchParams.get('cursor'))
    const requestedLimit = Number(request.nextUrl.searchParams.get('limit') ?? '20')
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) throw new EntryInputError('limit 必须是 1–50 的整数。')

    let selection = context.supabase
      .from('journal_entries')
      .select('id,title,body,mood,volume_id,version,created_at,updated_at,deleted_at')
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(requestedLimit + 1)

    selection = filter === 'trash' ? selection.not('deleted_at', 'is', null) : selection.is('deleted_at', null)
    if (query) {
      const escaped = escapeIlikeTerm(query)
      selection = selection.or(`title.ilike.*${escaped}*,body.ilike.*${escaped}*`)
    }
    if (cursor) {
      selection = selection.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
    }
    const { data, error } = await selection
    if (error) return errorResponse(500, 'JOURNAL_READ_FAILED', '暂时无法读取心笺，请重试。', id)
    const items = ((data ?? []) as Record<string, unknown>[]).map(mapEntry)
    const hasMore = items.length > requestedLimit
    const page = hasMore ? items.slice(0, requestedLimit) : items
    return NextResponse.json({ items: page, nextCursor: hasMore ? makeEntryCursor(page[page.length - 1]) : null })
  } catch (error) {
    return invalidRequest(error, id)
  }
}

export async function POST(request: NextRequest) {
  const id = requestId()
  const context = await currentUser(id)
  if ('response' in context) return context.response
  let payload
  try {
    payload = parseCreateEntry(await request.json())
  } catch (error) {
    return invalidRequest(error, id)
  }

  const { data: existing, error: existingError } = await context.supabase
    .from('journal_entries')
    .select('id,title,body,mood,volume_id,version,created_at,updated_at,deleted_at')
    .eq('id', payload.id)
    .eq('user_id', context.user.id)
    .maybeSingle()
  if (existingError) return errorResponse(500, 'JOURNAL_READ_FAILED', '暂时无法确认保存状态，请重试。', id)
  if (existing) {
    const entry = mapEntry(existing as Record<string, unknown>)
    if (!sameCreatePayload(entry, payload)) return errorResponse(409, 'IDEMPOTENCY_CONFLICT', '该保存标识已用于不同内容。', id)
    return NextResponse.json({ entry })
  }

  const { data, error } = await context.supabase.rpc('create_entry', createPayloadForRpc(payload))
  if (error) return rpcError(error, id)
  return NextResponse.json({ entry: mapEntry(data as Record<string, unknown>) }, { status: 201 })
}

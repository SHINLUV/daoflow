import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { EntryInputError, mapEntry, parseEntryId, parsePatchEntry, parsePurgeVersion, patchPayloadForRpc } from '@/lib/journal/entries'
import type { ApiError } from '@/lib/journal/contracts'

export const dynamic = 'force-dynamic'

function requestId() { return crypto.randomUUID() }
function fail(status: number, code: string, message: string, id: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message }, requestId: id, ...extra } satisfies ApiError & Record<string, unknown>, { status })
}
async function context(id: string) {
  if (!isSupabaseConfigured) return { response: fail(503, 'SUPABASE_UNAVAILABLE', '私人记录服务尚未配置，请稍后再试。', id) }
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { response: fail(401, 'AUTH_REQUIRED', '请先登录后再访问心笺。', id) }
  return { supabase, user }
}
function inputError(error: unknown, id: string) {
  return fail(400, 'INVALID_INPUT', error instanceof EntryInputError ? error.message : '请求体必须是合法 JSON。', id)
}
function pathId(params: { id: string }, requestId: string) {
  try { return { id: parseEntryId(params.id) } }
  catch (error) { return { response: inputError(error, requestId) } }
}
function writeError(error: { message?: string } | null, id: string) {
  const message = error?.message ?? ''
  if (message.includes('ENTRY_NOT_FOUND') || message.includes('VOLUME_NOT_FOUND')) return fail(404, 'NOT_FOUND', '记录不存在或你没有权限访问。', id)
  if (message.includes('CAS_CONFLICT')) return fail(409, 'VERSION_CONFLICT', '记录已在其他位置更新，请先处理本地草稿。', id)
  if (message.includes('ENTRY_RECYCLED') || message.includes('PURGE_REQUIRES_RECYCLED_ENTRY')) return fail(409, 'INVALID_STATE', '该操作不符合记录当前状态。', id)
  if (message.includes('INVALID_')) return fail(400, 'INVALID_INPUT', '提交内容不符合要求。', id)
  return fail(500, 'JOURNAL_WRITE_FAILED', '保存未完成，请保留内容后重试。', id)
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const id = requestId(); const validated = pathId(params, id); if ('response' in validated) return validated.response
  const auth = await context(id); if ('response' in auth) return auth.response
  const { data, error } = await auth.supabase.from('journal_entries').select('id,title,body,mood,volume_id,version,created_at,updated_at,deleted_at').eq('id', validated.id).eq('user_id', auth.user.id).maybeSingle()
  if (error) return fail(500, 'JOURNAL_READ_FAILED', '暂时无法读取心笺，请重试。', id)
  if (!data) return fail(404, 'NOT_FOUND', '记录不存在或你没有权限访问。', id)
  return NextResponse.json({ entry: mapEntry(data as Record<string, unknown>) })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const id = requestId(); const validated = pathId(params, id); if ('response' in validated) return validated.response
  const auth = await context(id); if ('response' in auth) return auth.response
  let patch
  try { patch = parsePatchEntry(await request.json()) } catch (error) { return inputError(error, id) }
  const { data, error } = await auth.supabase.rpc('patch_entry', patchPayloadForRpc(validated.id, patch))
  if (error) {
    const response = writeError(error, id)
    if (response.status === 409 && error.message?.includes('CAS_CONFLICT')) {
      const { data: current } = await auth.supabase.from('journal_entries').select('version').eq('id', validated.id).eq('user_id', auth.user.id).maybeSingle()
      const body = await response.json() as ApiError
      return NextResponse.json({ ...body, currentVersion: current?.version ?? null }, { status: 409 })
    }
    return response
  }
  return NextResponse.json({ entry: mapEntry(data as Record<string, unknown>) })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const id = requestId(); const validated = pathId(params, id); if ('response' in validated) return validated.response
  const auth = await context(id); if ('response' in auth) return auth.response
  let version
  try { version = parsePurgeVersion(await request.json()) } catch (error) { return inputError(error, id) }
  const { error } = await auth.supabase.rpc('purge_entry', { p_id: validated.id, p_version: version })
  if (error) {
    const response = writeError(error, id)
    if (response.status === 409 && error.message?.includes('CAS_CONFLICT')) {
      const { data: current } = await auth.supabase.from('journal_entries').select('version').eq('id', validated.id).eq('user_id', auth.user.id).maybeSingle()
      const body = await response.json() as ApiError
      return NextResponse.json({ ...body, currentVersion: current?.version ?? null }, { status: 409 })
    }
    return response
  }
  return NextResponse.json({ deleted: true })
}

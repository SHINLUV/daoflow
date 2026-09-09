import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { parseVolumeId, parseVolumePatch, toVolume } from '@/lib/journal/volumes'

const columns = 'id,title,archived_at,version,created_at,updated_at'
const fail = (status: number, code: string, message: string, requestId: string, extra: Record<string, unknown> = {}) => NextResponse.json({ error: { code, message }, requestId, ...extra }, { status })

async function auth(requestId: string) {
  if (!isSupabaseConfigured) return { response: fail(503, 'SUPABASE_UNAVAILABLE', '私人卷册服务尚未配置。', requestId) }
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return error || !user ? { response: fail(401, 'AUTH_REQUIRED', '请先登录后管理卷册。', requestId) } : { supabase, user }
}

function valid(params: { id: string }, requestId: string) {
  try { return { id: parseVolumeId(params.id) } }
  catch (error) { return { response: fail(400, 'INVALID_INPUT', error instanceof Error ? error.message : 'id 无效。', requestId) } }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const requestId = crypto.randomUUID()
  const parsed = valid(params, requestId)
  if ('response' in parsed) return parsed.response
  const context = await auth(requestId)
  if ('response' in context) return context.response
  const { data, error } = await context.supabase.from('journal_volumes').select(columns).eq('id', parsed.id).eq('user_id', context.user.id).maybeSingle()
  if (error) return fail(500, 'VOLUMES_READ_FAILED', '暂时无法读取卷册。', requestId)
  if (!data) return fail(404, 'NOT_FOUND', '卷册不存在或你没有权限访问。', requestId)
  const countResult = await context.supabase.from('journal_entries').select('*', { count: 'exact', head: true }).eq('user_id', context.user.id).eq('volume_id', parsed.id).is('deleted_at', null)
  if (countResult.error) return fail(500, 'VOLUMES_READ_FAILED', '暂时无法统计卷册内容。', requestId)
  return NextResponse.json({ volume: toVolume(data, countResult.count ?? 0) })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = crypto.randomUUID()
  const parsed = valid(params, requestId)
  if ('response' in parsed) return parsed.response
  const context = await auth(requestId)
  if ('response' in context) return context.response
  try {
    const input = parseVolumePatch(await request.json())
    const { data, error } = await context.supabase.rpc('patch_volume', {
      p_id: parsed.id, p_version: input.version, p_title: input.title, p_title_set: input.hasTitle,
      p_archived: input.archived, p_archived_set: input.hasArchived,
    })
    if (error) {
      if (error.message.includes('NOT_FOUND')) return fail(404, 'NOT_FOUND', '卷册不存在或你没有权限访问。', requestId)
      if (error.message.includes('CAS')) {
        const { data: current } = await context.supabase.from('journal_volumes').select('version').eq('id', parsed.id).eq('user_id', context.user.id).maybeSingle()
        return fail(409, 'VERSION_CONFLICT', '卷册已在其他位置更新，请重新加载。', requestId, { currentVersion: current?.version ?? null })
      }
      return fail(500, 'VOLUME_PATCH_FAILED', '卷册未能更新。', requestId)
    }
    return NextResponse.json({ volume: toVolume(data) })
  } catch (error) {
    return fail(400, 'INVALID_INPUT', error instanceof Error ? error.message : '请求无效。', requestId)
  }
}

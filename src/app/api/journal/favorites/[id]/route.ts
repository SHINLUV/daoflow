import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server'
import { isFavoriteId, parseFavoriteDelete, parseFavoritePatch, toFavorite } from '@/lib/journal/favorites'
import type { ApiError, Favorite } from '@/lib/journal/contracts'

const FAVORITE_COLUMNS = 'id, chapter_id, excerpt, note, version, created_at, updated_at'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = randomUUID()
  if (!isFavoriteId(params.id)) return errorResponse(400, 'INVALID_FAVORITE_ID', '收藏标识无效。', requestId)
  const authenticated = await getAuthenticatedClient(requestId)
  if (authenticated instanceof NextResponse) return authenticated
  const input = parseFavoritePatch(await parseJson(request))
  if (!input) return errorResponse(400, 'INVALID_FAVORITE_PATCH', '请提交当前版本和不超过2000字的批注。', requestId)

  const { data: existing, error: readError } = await getOwnedFavorite(authenticated, params.id)
  if (readError) return errorResponse(500, 'FAVORITE_READ_FAILED', '暂时无法读取收藏，请稍后重试。', requestId)
  if (!existing) return errorResponse(404, 'FAVORITE_NOT_FOUND', '未找到该收藏。', requestId)
  if (existing.version !== input.version) return errorResponse(409, 'FAVORITE_VERSION_CONFLICT', '该收藏已在其他位置更新，请刷新后保留你的批注再试。', requestId)

  const { data, error } = await authenticated
    .rpc('patch_favorite', { p_id: params.id, p_version: input.version, p_note: input.note })
    .select(FAVORITE_COLUMNS)
    .maybeSingle()
  if (error) return errorResponse(500, 'FAVORITE_PATCH_FAILED', '暂时无法更新批注，请稍后重试。', requestId)
  if (!data) return errorResponse(409, 'FAVORITE_VERSION_CONFLICT', '该收藏已在其他位置更新，请刷新后保留你的批注再试。', requestId)
  return NextResponse.json({ favorite: toFavorite(data) satisfies Favorite })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const requestId = randomUUID()
  if (!isFavoriteId(params.id)) return errorResponse(400, 'INVALID_FAVORITE_ID', '收藏标识无效。', requestId)
  const authenticated = await getAuthenticatedClient(requestId)
  if (authenticated instanceof NextResponse) return authenticated
  const version = parseFavoriteDelete(await parseJson(request))
  if (!version) return errorResponse(400, 'INVALID_FAVORITE_DELETE', '请提交当前收藏版本。', requestId)

  const { data: existing, error: readError } = await getOwnedFavorite(authenticated, params.id)
  if (readError) return errorResponse(500, 'FAVORITE_READ_FAILED', '暂时无法读取收藏，请稍后重试。', requestId)
  if (!existing) return errorResponse(404, 'FAVORITE_NOT_FOUND', '未找到该收藏。', requestId)
  if (existing.version !== version) return errorResponse(409, 'FAVORITE_VERSION_CONFLICT', '该收藏已在其他位置更新，请刷新后再取消收藏。', requestId)

  const { data, error } = await authenticated.rpc('delete_favorite', { p_id: params.id, p_version: version })
  if (error) return errorResponse(500, 'FAVORITE_DELETE_FAILED', '暂时无法取消收藏，请稍后重试。', requestId)
  if (!data) return errorResponse(409, 'FAVORITE_VERSION_CONFLICT', '该收藏已在其他位置更新，请刷新后再取消收藏。', requestId)
  return new NextResponse(null, { status: 204 })
}

async function getOwnedFavorite(supabase: ReturnType<typeof createClient>, id: string) {
  return supabase
    .from('journal_favorites')
    .select(FAVORITE_COLUMNS)
    .eq('id', id)
    .maybeSingle()
}

async function getAuthenticatedClient(requestId: string) {
  if (!isSupabaseConfigured) return errorResponse(503, 'SUPABASE_UNAVAILABLE', '收藏需要数据库配置；本地经典仍可阅读。', requestId)
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return errorResponse(401, 'AUTH_REQUIRED', '请先登录后管理收藏与批注。', requestId)
    return supabase
  } catch {
    return errorResponse(503, 'SUPABASE_UNAVAILABLE', '收藏服务暂不可用；本地经典仍可阅读。', requestId)
  }
}

async function parseJson(request: NextRequest): Promise<unknown> {
  try { return await request.json() } catch { return null }
}

function errorResponse(status: number, code: string, message: string, requestId: string) {
  const payload: ApiError = { error: { code, message }, requestId }
  return NextResponse.json(payload, { status })
}

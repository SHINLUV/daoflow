import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server'
import {
  FAVORITES_PAGE_SIZE,
  decodeFavoriteCursor,
  parseFavoriteCreate,
  toFavorite,
  toFavoritePage,
} from '@/lib/journal/favorites'
import type { ApiError, Favorite } from '@/lib/journal/contracts'

const FAVORITE_COLUMNS = 'id, chapter_id, excerpt, note, version, created_at, updated_at'

export async function GET(request: NextRequest) {
  const requestId = randomUUID()
  const authenticated = await getAuthenticatedClient(requestId)
  if (authenticated instanceof NextResponse) return authenticated

  const cursor = decodeFavoriteCursor(request.nextUrl.searchParams.get('cursor'))
  if (request.nextUrl.searchParams.has('cursor') && !cursor) return errorResponse(400, 'INVALID_CURSOR', '收藏分页游标无效。', requestId)
  const chapterParameter = request.nextUrl.searchParams.get('chapterId')
  const chapterId = chapterParameter === null ? null : Number(chapterParameter)
  if (chapterParameter !== null && (chapterId === null || !/^\d+$/.test(chapterParameter) || !Number.isInteger(chapterId) || chapterId < 1 || chapterId > 81)) {
    return errorResponse(400, 'INVALID_CHAPTER', '章节须在第一章至第八十一章之间。', requestId)
  }

  let query = authenticated.supabase
    .from('journal_favorites')
    .select(FAVORITE_COLUMNS)
    .eq('user_id', authenticated.user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FAVORITES_PAGE_SIZE + 1)

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`)
  }
  if (chapterId !== null) query = query.eq('chapter_id', chapterId)

  const { data, error } = await query
  if (error) return errorResponse(500, 'FAVORITES_READ_FAILED', '暂时无法读取收藏，请稍后重试。', requestId)
  return NextResponse.json(toFavoritePage(data ?? []))
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID()
  const authenticated = await getAuthenticatedClient(requestId)
  if (authenticated instanceof NextResponse) return authenticated

  const body = await parseJson(request)
  const input = parseFavoriteCreate(body)
  if (!input) return errorResponse(400, 'INVALID_FAVORITE', '请选择第一至第八十一章中的连续原文片段，批注不超过2000字。', requestId)

  const { data, error } = await authenticated.supabase
    .rpc('create_favorite', {
      p_id: input.id,
      p_chapter_id: input.chapterId,
      p_excerpt: input.excerpt,
      p_note: input.note,
    })
    .select(FAVORITE_COLUMNS)
    .single()

  if (error || !data) {
    const status = error?.code === '23505' ? 409 : 500
    return errorResponse(status, status === 409 ? 'FAVORITE_ID_CONFLICT' : 'FAVORITE_CREATE_FAILED', status === 409 ? '该收藏标识已被用于其他内容。' : '暂时无法保存收藏，请稍后重试。', requestId)
  }
  return NextResponse.json({ favorite: toFavorite(data) satisfies Favorite }, { status: 201 })
}

async function getAuthenticatedClient(requestId: string) {
  if (!isSupabaseConfigured) return errorResponse(503, 'SUPABASE_UNAVAILABLE', '收藏需要数据库配置；本地经典仍可阅读。', requestId)
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return errorResponse(401, 'AUTH_REQUIRED', '请先登录后管理收藏与批注。', requestId)
    return { supabase, user }
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

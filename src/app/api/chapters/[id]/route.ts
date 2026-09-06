/**
 * GET /api/chapters/:id
 * 从 Supabase chapters 表读取章节数据
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLocalChapter } from '@/lib/chapters'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const chapterId = Number(params.id)

  if (!/^\d+$/.test(params.id) || !Number.isInteger(chapterId) || chapterId < 1 || chapterId > 81) {
    return NextResponse.json(
      { error: '章节不存在' },
      { status: 404 }
    )
  }

  let chapter = getLocalChapter(chapterId)
  try {
    const supabase = createClient()
    const { data } = await supabase
      .from('chapters')
      .select('id, original_text, vernacular_text')
      .eq('id', chapterId)
      .abortSignal(AbortSignal.timeout(4000))
      .single()
    if (data?.original_text && data?.vernacular_text) {
      chapter = { ...chapter!, ...data }
    }
  } catch {
    // Keep the bundled chapter when the database is unavailable.
  }

  if (!chapter) {
    return NextResponse.json(
      { error: '章节不存在' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    id: chapter.id,
    originalText: chapter.original_text,
    vernacularText: chapter.vernacular_text,
    prevId: chapterId > 1 ? chapterId - 1 : 0,
    nextId: chapterId < 81 ? chapterId + 1 : 0,
  })
}

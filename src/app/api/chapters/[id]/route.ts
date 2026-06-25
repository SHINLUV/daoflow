/**
 * GET /api/chapters/:id
 * 从 Supabase chapters 表读取章节数据
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const chapterId = parseInt(params.id, 10)

  if (isNaN(chapterId) || chapterId < 1 || chapterId > 81) {
    return NextResponse.json(
      { error: '章节不存在' },
      { status: 404 }
    )
  }

  const supabase = createClient()

  const { data: chapter, error } = await supabase
    .from('chapters')
    .select('id, original_text, vernacular_text')
    .eq('id', chapterId)
    .single()

  if (error || !chapter) {
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

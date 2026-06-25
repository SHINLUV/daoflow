/**
 * GET /api/chapters/:id
 * TODO: 接入数据库后从 chapters 表读取
 * 当前返回硬编码的 3 章用于前端开发
 */

import { NextRequest, NextResponse } from 'next/server'

// 临时 mock 数据（M1 阶段，后续从 DB 读取）
interface ChapterData {
  id: number
  originalText: string
  vernacularText: string
  prevId: number
  nextId: number
}

const MOCK_CHAPTERS: Record<string, ChapterData> = {
  '1': {
    id: 1,
    originalText: '道可道，非常道；名可名，非常名。无名天地之始，有名万物之母。故常无欲，以观其妙；常有欲，以观其徼。此两者同出而异名，同谓之玄。玄之又玄，众妙之门。',
    vernacularText: '可以用语言说出来的道，就不是永恒不变的道；可以用名字来称呼的名，就不是永恒不变的名。无，是天地的本始；有，是万物的根源。',
    prevId: 81,
    nextId: 2,
  },
  '44': {
    id: 44,
    originalText: '名与身孰亲？身与货孰多？得与亡孰病？甚爱必大费，多藏必厚亡。故知足不辱，知止不殆，可以长久。',
    vernacularText: '名声与生命哪一个更亲近？生命与财货哪一个更贵重？得到与失去哪一个更有害？过分的爱惜必定造成极大的耗费，过多的储藏必定造成严重的损失。所以知道满足就不会受到羞辱，知道适可而止就不会遇到危险，这样才可以长久安全。',
    prevId: 43,
    nextId: 45,
  },
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const chapter = MOCK_CHAPTERS[params.id]

  if (!chapter) {
    return NextResponse.json(
      { error: '章节不存在' },
      { status: 404 }
    )
  }

  return NextResponse.json(chapter)
}

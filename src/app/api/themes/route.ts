/**
 * GET /api/themes — 返回 6 大主题列表
 * 可缓存 24h
 */

import { NextResponse } from 'next/server'

const THEMES = [
  { id: 'anxiety',    name: '焦虑与情绪', subtitle: '如何面对内心的不安',           displayOrder: 1 },
  { id: 'relationship', name: '关系与边界', subtitle: '如何建立健康的关系',           displayOrder: 2 },
  { id: 'decision',   name: '选择与决策', subtitle: '如何做出明智的选择',           displayOrder: 3 },
  { id: 'career',     name: '事业与创业', subtitle: '如何在工作中找到方向',         displayOrder: 4 },
  { id: 'growth',     name: '成长与自我', subtitle: '如何成为更好的自己',           displayOrder: 5 },
  { id: 'wuwei',      name: '无为与有为', subtitle: '如何平衡行动与等待',           displayOrder: 6 },
]

export async function GET() {
  return NextResponse.json(
    { themes: THEMES },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600',
      },
    }
  )
}

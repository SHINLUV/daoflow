/**
 * GET /api/daily-quote — 今日一句
 * 按日期种子伪随机选取，可边缘缓存到当天结束
 */

import { NextResponse } from 'next/server'

// 81 句精选每日语录（按章节号排序）
const QUOTES: Record<number, string> = {
  1: '道可道，非常道。',
  2: '有无相生，难易相成。',
  8: '上善若水，水善利万物而不争。',
  9: '功遂身退，天之道也。',
  11: '有之以为利，无之以为用。',
  15: '孰能浊以静之徐清？',
  16: '致虚极，守静笃。',
  22: '曲则全，枉则直。',
  23: '飘风不终朝，骤雨不终日。',
  25: '人法地，地法天，天法道，道法自然。',
  33: '知人者智，自知者明。胜人者有力，自胜者强。',
  37: '道常无为而无不为。',
  40: '反者道之动，弱者道之用。',
  41: '大器晚成，大音希声，大象无形。',
  42: '万物负阴而抱阳，冲气以为和。',
  43: '天下之至柔，驰骋天下之至坚。',
  44: '知足不辱，知止不殆。',
  45: '大巧若拙，大辩若讷。',
  46: '祸莫大于不知足，咎莫大于欲得。',
  48: '为学日益，为道日损。',
  56: '知者不言，言者不知。',
  58: '祸兮福之所倚，福兮祸之所伏。',
  63: '天下难事，必作于易；天下大事，必作于细。',
  64: '千里之行，始于足下。',
  67: '我有三宝：一曰慈，二曰俭，三曰不敢为天下先。',
  70: '圣人被褐而怀玉。',
  76: '柔弱者生之徒。',
  78: '天下莫柔弱于水，而攻坚强者莫之能胜。',
  81: '信言不美，美言不信。善者不辩，辩者不善。',
}

export async function GET() {
  const today = new Date()
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  )
  const chapterKeys = Object.keys(QUOTES).map(Number)
  const chapterId = chapterKeys[dayOfYear % chapterKeys.length]
  const quote = QUOTES[chapterId]

  // 缓存到当天午夜
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)
  const maxAge = Math.floor((tomorrow.getTime() - Date.now()) / 1000)

  return NextResponse.json(
    {
      date: today.toISOString().split('T')[0],
      chapterId,
      quote,
      attribution: `《道德经·第${chapterId}章》`,
    },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=3600`,
      },
    }
  )
}

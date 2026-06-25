/**
 * DaoFlow 种子数据导入脚本
 *
 * 使用方法:
 *   1. 确保 .env.local 中配置了 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY
 *   2. npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/seed/seed.ts
 *
 * ⚠️ 此脚本使用 service_role key，仅在本地或受控环境中运行
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'
import { readFileSync } from 'fs'

// 加载 .env.local
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少环境变量: NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface Chapter {
  id: number
  original_text: string
  vernacular_text: string
  chapter_theme_tags: string[]
  preset_interpretation: string
}

async function seed() {
  console.log('🌊 DaoFlow 种子数据导入开始...\n')

  // ===== 1. 导入 81 章 =====
  console.log('📖 导入道德经 81 章...')
  const chaptersPath = path.resolve(__dirname, 'chapters.json')
  const chapters: Chapter[] = JSON.parse(readFileSync(chaptersPath, 'utf-8'))

  const { error: chapterError } = await supabase
    .from('chapters')
    .upsert(chapters, { onConflict: 'id' })

  if (chapterError) {
    console.error('❌ 章节导入失败:', chapterError.message)
    process.exit(1)
  }
  console.log(`✅ 已导入 ${chapters.length} 章`)

  // ===== 2. 导入 6 大主题 =====
  console.log('\n🏷️  导入主题数据...')
  const themes = [
    { id: 'anxiety',    name: '焦虑与情绪', subtitle: '如何面对内心的不安',           display_order: 1 },
    { id: 'relationship', name: '关系与边界', subtitle: '如何建立健康的关系',           display_order: 2 },
    { id: 'decision',   name: '选择与决策', subtitle: '如何做出明智的选择',           display_order: 3 },
    { id: 'career',     name: '事业与创业', subtitle: '如何在工作中找到方向',         display_order: 4 },
    { id: 'growth',     name: '成长与自我', subtitle: '如何成为更好的自己',           display_order: 5 },
    { id: 'wuwei',      name: '无为与有为', subtitle: '如何平衡行动与等待',           display_order: 6 },
  ]

  const { error: themeError } = await supabase
    .from('themes')
    .upsert(themes, { onConflict: 'id' })

  if (themeError) {
    console.error('❌ 主题导入失败:', themeError.message)
    process.exit(1)
  }
  console.log(`✅ 已导入 ${themes.length} 个主题`)

  // ===== 3. 导入关键词映射表 =====
  console.log('\n🔑 导入关键词映射表...')
  const keywordMap = getKeywordMap()
  const { error: kwError } = await supabase
    .from('keyword_chapter_map')
    .upsert(keywordMap, { onConflict: 'keyword' })

  if (kwError) {
    console.error('❌ 关键词映射导入失败:', kwError.message)
    process.exit(1)
  }
  console.log(`✅ 已导入 ${keywordMap.length} 组关键词映射`)

  // ===== 4. 导入每日一句（覆盖未来一年） =====
  console.log('\n📅 生成每日一句...')
  const dailyQuotes = generateDailyQuotes()
  const { error: dqError } = await supabase
    .from('daily_quotes')
    .upsert(dailyQuotes, { onConflict: 'date' })

  if (dqError) {
    console.error('❌ 每日一句导入失败:', dqError.message)
    process.exit(1)
  }
  console.log(`✅ 已生成 ${dailyQuotes.length} 天的每日一句`)

  console.log('\n🎉 种子数据导入完成！')
}

/**
 * 关键词 → 章节映射表
 * ⚠️ 此表上线前需人工审核语义匹配是否合理
 * 覆盖常见情绪/人生困惑关键词
 */
function getKeywordMap() {
  return [
    // 情绪类
    { keyword: '迷茫',     chapter_ids: [33, 71, 64, 1] },
    { keyword: '焦虑',     chapter_ids: [44, 46, 12, 16] },
    { keyword: '不安',     chapter_ids: [16, 5, 23, 13] },
    { keyword: '烦躁',     chapter_ids: [26, 12, 45] },
    { keyword: '沮丧',     chapter_ids: [23, 40, 22, 41] },
    { keyword: '孤独',     chapter_ids: [20, 70, 62] },
    { keyword: '害怕',     chapter_ids: [13, 50, 73] },
    { keyword: '恐惧',     chapter_ids: [74, 13, 50, 73] },
    { keyword: '愤怒',     chapter_ids: [68, 31, 26] },
    { keyword: '悲伤',     chapter_ids: [23, 40, 62] },
    { keyword: '自责',     chapter_ids: [8, 33, 71, 62] },

    // 决策类
    { keyword: '选择',     chapter_ids: [64, 2, 44, 63] },
    { keyword: '决定',     chapter_ids: [64, 73, 44] },
    { keyword: '辞职',     chapter_ids: [64, 9, 44] },
    { keyword: '转行',     chapter_ids: [64, 41, 70] },
    { keyword: '放弃',     chapter_ids: [48, 9, 64] },
    { keyword: '不知道怎么办', chapter_ids: [64, 33, 71, 1] },

    // 关系类
    { keyword: '关系',     chapter_ids: [8, 66, 61, 27] },
    { keyword: '冲突',     chapter_ids: [31, 68, 79] },
    { keyword: '沟通',     chapter_ids: [56, 17, 27] },
    { keyword: '家庭',     chapter_ids: [18, 54, 52] },
    { keyword: '朋友',     chapter_ids: [27, 62, 81] },
    { keyword: '伴侣',     chapter_ids: [61, 51, 66] },

    // 工作类
    { keyword: '工作',     chapter_ids: [63, 64, 9, 17] },
    { keyword: '创业',     chapter_ids: [64, 59, 41] },
    { keyword: '失败',     chapter_ids: [40, 64, 22, 43] },
    { keyword: '成功',     chapter_ids: [9, 46, 24, 41] },
    { keyword: '压力',     chapter_ids: [44, 5, 48, 26] },
    { keyword: '加班',     chapter_ids: [44, 46, 9] },
    { keyword: '竞争',     chapter_ids: [68, 22, 66, 3] },

    // 成长类
    { keyword: '改变',     chapter_ids: [48, 15, 64] },
    { keyword: '成长',     chapter_ids: [25, 54, 33] },
    { keyword: '学习',     chapter_ids: [48, 41, 71] },
    { keyword: '自我',     chapter_ids: [33, 7, 13, 70] },
    { keyword: '目标',     chapter_ids: [64, 63, 9] },
    { keyword: '意义',     chapter_ids: [1, 25, 41] },
    { keyword: '拖延',     chapter_ids: [63, 38, 64] },

    // 其它常见关键词
    { keyword: '内卷',     chapter_ids: [3, 46, 44, 80] },
    { keyword: '躺平',     chapter_ids: [48, 80, 37] },
    { keyword: '累',       chapter_ids: [44, 48, 26, 9] },
    { keyword: '不公平',   chapter_ids: [77, 5, 58] },
    { keyword: '后悔',     chapter_ids: [64, 44, 79] },
  ]
}

/**
 * 按日期种子生成每日一句（覆盖今天起 365 天）
 */
function generateDailyQuotes() {
  const quotes = []
  const startDate = new Date()
  // 种子随机：用固定偏移确保同一天始终返回同一章
  const baseSeed = 42

  for (let i = 0; i < 365; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split('T')[0]

    // 基于日期做确定性"随机"
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
    )
    const chapterId = ((dayOfYear * baseSeed + date.getFullYear()) % 81) + 1

    quotes.push({ date: dateStr, chapter_id: chapterId })
  }

  return quotes
}

seed().catch(console.error)

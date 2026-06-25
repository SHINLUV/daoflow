/**
 * DaoFlow 数据校验脚本
 *
 * 检查:
 *   1. chapters 表所有 1-81 章都存在
 *   2. preset_interpretation 字段都不为空
 *   3. keyword_chapter_map 关键词数量
 *   4. themes 6 个主题完整
 *
 * 使用方法:
 *   npx ts-node --compiler-options '{"module":"commonjs","moduleResolution":"node"}' scripts/validate.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Chapter {
  id: number
  original_text: string
  preset_interpretation: string
}

async function validate() {
  console.log('🔍 DaoFlow 数据校验开始...\n')
  let errors = 0

  // 1. 检查 81 章完整性
  console.log('1. 检查 81 章完整性...')
  const { data: chapters, error } = await supabase
    .from('chapters')
    .select('id, original_text, preset_interpretation')
    .order('id')

  if (error) {
    console.error(`   ❌ 查询失败: ${error.message}`)
    process.exit(1)
  }

  const ids = (chapters as Chapter[]).map(c => c.id)
  const missing: number[] = []
  for (let i = 1; i <= 81; i++) {
    if (!ids.includes(i)) missing.push(i)
  }

  if (missing.length > 0) {
    console.error(`   ❌ 缺失章节: ${missing.join(', ')}`)
    errors++
  } else {
    console.log(`   ✅ 81 章全部存在`)
  }

  // 2. 检查 preset_interpretation 非空
  console.log('\n2. 检查 preset_interpretation 非空...')
  const emptyPreset = (chapters as Chapter[]).filter(
    c => !c.preset_interpretation || c.preset_interpretation.trim() === ''
  )
  if (emptyPreset.length > 0) {
    console.error(`   ❌ ${emptyPreset.length} 章的 preset_interpretation 为空: ${emptyPreset.map(c => c.id).join(', ')}`)
    errors++
  } else {
    console.log(`   ✅ 所有章节 preset_interpretation 非空`)
  }

  // 3. 检查 original_text 非空
  console.log('\n3. 检查 original_text 非空...')
  const emptyText = (chapters as Chapter[]).filter(
    c => !c.original_text || c.original_text.trim() === ''
  )
  if (emptyText.length > 0) {
    console.error(`   ❌ ${emptyText.length} 章的 original_text 为空`)
    errors++
  } else {
    console.log(`   ✅ 所有章节 original_text 非空`)
  }

  // 4. 检查 keyword_chapter_map
  console.log('\n4. 检查 keyword_chapter_map...')
  const { data: keywords, error: kwError } = await supabase
    .from('keyword_chapter_map')
    .select('keyword')

  if (kwError) {
    console.error(`   ❌ 查询失败: ${kwError.message}`)
    errors++
  } else {
    const count = (keywords as any[]).length
    if (count < 30) {
      console.error(`   ❌ 关键词数量不足: ${count}（需要至少 30 组）`)
      errors++
    } else {
      console.log(`   ✅ 关键词数量: ${count}`)
    }
  }

  // 5. 检查 themes
  console.log('\n5. 检查 themes...')
  const { data: themes, error: tError } = await supabase
    .from('themes')
    .select('id')

  if (tError) {
    console.error(`   ❌ 查询失败: ${tError.message}`)
    errors++
  } else {
    const count = (themes as any[]).length
    if (count !== 6) {
      console.error(`   ❌ 主题数量: ${count}（需要 6 个）`)
      errors++
    } else {
      console.log(`   ✅ 6 个主题完整`)
    }
  }

  // 汇总
  console.log(`\n${'='.repeat(40)}`)
  if (errors === 0) {
    console.log('🎉 所有校验通过！')
  } else {
    console.error(`❌ 发现 ${errors} 个问题，请检查后重新导入`)
    process.exit(1)
  }
}

validate().catch(console.error)

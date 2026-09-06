/**
 * 通过 Supabase REST API 导入 81 章数据
 * 用法: node scripts/seed/seed-chapters.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing chapters')
}
const supabase = createClient(supabaseUrl, serviceRoleKey)

async function seed() {
  const chapters = JSON.parse(
    readFileSync(resolve(__dirname, 'chapters.json'), 'utf-8')
  )

  // 分批插入，每批 10 章
  const batchSize = 10
  for (let i = 0; i < chapters.length; i += batchSize) {
    const batch = chapters.slice(i, i + batchSize)
    const { error } = await supabase
      .from('chapters')
      .upsert(batch, { onConflict: 'id' })

    if (error) {
      console.error(`批次 ${i / batchSize + 1} 失败:`, error.message)
      process.exit(1)
    }
    console.log(`✅ 第 ${i + 1}-${Math.min(i + batchSize, chapters.length)} 章导入成功`)
  }

  console.log(`\n🎉 全部 ${chapters.length} 章导入完成`)
}

seed().catch(console.error)

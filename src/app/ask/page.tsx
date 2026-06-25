'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import CloudBackground from '@/components/CloudBackground'

interface AskResult {
  matchedChapter: number
  interpretation: string
  followUpQuestion: string | null
  sessionId: string | null
  meta: {
    provider: string
    degraded: boolean
  }
}

/**
 * 问道结果页
 *
 * 展示: 匹配章节号 → 原文 → 白话解读 → 反问句
 * 降级时显示对应提示文案
 */
function AskContent() {
  const searchParams = useSearchParams()
  const question = searchParams.get('q') || ''
  const [result, setResult] = useState<AskResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!question) {
      setError('未提供问题')
      setLoading(false)
      return
    }

    fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('API 请求失败')
        return res.json()
      })
      .then((data) => {
        setResult(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [question])

  return (
    <div className="relative min-h-screen bg-cloud-white">
      <CloudBackground />
      <NavBar />

      <div className="relative z-10 max-w-[640px] mx-auto px-6 pt-32 pb-20">
        {/* 返回链接 */}
        <Link
          href="/"
          className="inline-block text-[13px] text-shadow-gray hover:text-ink transition-colors duration-300 mb-12"
        >
          ← 返回问道
        </Link>

        {/* 用户问题回显 */}
        <p className="text-[15px] text-shadow-gray mb-8">
          {question}
        </p>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-mist-gray border-t-ink rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-ink/60 py-12 text-center">加载失败：{error}</p>
        )}

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* 降级提示 */}
            {result.meta.degraded && (
              <div className="mb-6 px-4 py-3 border border-dawn-gold/30 rounded-lg text-[13px] text-shadow-gray">
                为你呈现本章原文与通用解读
              </div>
            )}

            {/* 章节号 */}
            <span className="text-[12px] tracking-widest text-dawn-gold uppercase">
              第{result.matchedChapter}章
            </span>

            {/* AI 解读 */}
            <p className="mt-4 text-[18px] text-ink leading-[2.2] tracking-wider">
              {result.interpretation}
            </p>

            {/* 反问句 */}
            {result.followUpQuestion && (
              <p className="mt-8 text-[16px] text-shadow-gray italic leading-relaxed">
                {result.followUpQuestion}
              </p>
            )}

            {/* 分隔线 */}
            <div className="mt-12 mb-8 h-px bg-mist-gray/30" />

            {/* 操作入口 */}
            <div className="flex gap-6">
              <Link
                href={`/chapters/${result.matchedChapter}`}
                className="text-[14px] text-ridge-blue hover:text-ink transition-colors duration-300"
              >
                查看原文
              </Link>
              <Link
                href="/"
                className="text-[14px] text-ridge-blue hover:text-ink transition-colors duration-300"
              >
                继续问道
              </Link>
            </div>

            {/* 提供者信息（调试用） */}
            <p className="mt-8 text-[11px] text-shadow-gray/40">
              由 {result.meta.provider === 'agnes' ? 'Agnes AI' : result.meta.provider === 'deepseek' ? 'DeepSeek' : '本地知识库'} 回答
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function AskPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cloud-white flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-mist-gray border-t-ink rounded-full animate-spin" />
      </div>
    }>
      <AskContent />
    </Suspense>
  )
}

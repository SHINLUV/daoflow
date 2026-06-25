'use client'

import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Copy, Check } from '@phosphor-icons/react'

interface QuoteData {
  date: string
  chapterId: number
  quote: string
  attribution: string
}

/**
 * 今日一句 — 首屏核心钩子
 *
 * 每日可变内容奖励。
 * 对标 Stoic/Calm: 用户打开 App 即获得价值，无需主动输入。
 *
 * 规格:
 *   引用文字: 20-24px，墨色 85%，居中
 *   出处: 14px，山影灰
 *   标签 "今日一句": 11px，低调
 *   淡入动效 600ms，加载后 0.3 秒触发（先于输入框）
 */
export default function DailyQuote() {
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!quote) return
    const text = `「${quote.quote}」\n—— ${quote.attribution}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 降级：fallback 无操作
    }
  }, [quote])

  useEffect(() => {
    // 客户端 fetch /api/daily-quote
    fetch('/api/daily-quote')
      .then((res) => res.json())
      .then(setQuote)
      .catch(() => {
        // 降级：显示默认语录
        setQuote({
          date: '',
          chapterId: 44,
          quote: '知足不辱，知止不殆。',
          attribution: '《道德经·第四十四章》',
        })
      })
  }, [])

  if (!quote) return null

  return (
    <motion.div
      className="flex flex-col items-center gap-3"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.3 }}
    >
      {/* 标签：低调到几乎看不见 */}
      <span className="text-[11px] tracking-[0.2em] text-shadow-gray/40 uppercase">
        今日一句
      </span>

      {/* 引用：核心钩子 — 用户打开即获得的价值 */}
      <p className="text-lg sm:text-xl md:text-2xl text-ink/85 leading-relaxed text-center max-w-[480px] px-4 tracking-wider">
        {quote.quote}
      </p>

      {/* 出处 */}
      <span className="text-[13px] text-shadow-gray/50 tracking-wider">
        —— {quote.attribution}
      </span>

      {/* 复制分享 — 对标 Daily Stoic Quotes 的 quote maker */}
      <button
        type="button"
        onClick={handleCopy}
        className="
          flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full
          text-[12px] tracking-wider
          text-shadow-gray/40 hover:text-ink/60
          border border-transparent hover:border-ridge-blue/10
          transition-all duration-300
          cursor-pointer
        "
        aria-label="复制今日一句"
      >
        {copied ? (
          <>
            <Check size={14} weight="bold" />
            已复制
          </>
        ) : (
          <>
            <Copy size={14} />
            复制
          </>
        )}
      </button>
    </motion.div>
  )
}

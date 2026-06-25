'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from '@phosphor-icons/react'

interface AskInputProps {
  onSubmit: (question: string) => void
  disabled?: boolean
  suggestions?: string[]
}

const DEFAULT_SUGGESTIONS = [
  '最近有些焦虑',
  '做了一个重要的决定',
  '和某人的关系让我困扰',
]

/**
 * 问道输入框
 *
 * 规格:
 *   宽度 40-50% 屏宽，最小 480px
 *   高度 56-64px，圆角 28-32px（胶囊形）
 *   聚焦态边框变晨光金 #D4B896
 *   右侧圆形墨色提交按钮
 *   淡入动效 600ms，加载后 0.8 秒触发
 *
 * 建议词:
 *   若外部传入 suggestions 则使用
 *   否则自动从 /api/daily-quote 获取今日建议词
 *   降级：API 失败时使用默认建议词
 */
export default function AskInput({ onSubmit, disabled = false, suggestions }: AskInputProps) {
  const [dynamicSuggestions, setDynamicSuggestions] = useState(suggestions || DEFAULT_SUGGESTIONS)

  // 自动获取每日建议词（仅当外部未传入时）
  useEffect(() => {
    if (suggestions) return // 外部已传入，不需要获取
    fetch('/api/daily-quote')
      .then(r => r.json())
      .then(data => {
        if (data.suggestions?.length) {
          setDynamicSuggestions(data.suggestions)
        }
      })
      .catch(() => {}) // 静默降级，保持默认建议词
  }, [suggestions])
  const [value, setValue] = useState('')
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && !disabled) {
      onSubmit(trimmed)
    }
  }

  return (
    <motion.div
      className="w-full max-w-[50%] min-w-[320px] md:min-w-[480px] mx-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.8 }}
    >
      {/* 轻量引导词 — 降低空白页恐惧（Reflectly 启发） */}
      <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
        {dynamicSuggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setValue(suggestion)
              inputRef.current?.focus()
            }}
            disabled={disabled}
            className="
              px-3 py-1.5 rounded-full text-[13px] tracking-wider
              text-shadow-gray/60 hover:text-ink/80
              border border-ridge-blue/10 hover:border-ridge-blue/25
              bg-cloud-white/30 hover:bg-cloud-white/60
              transition-all duration-300
              cursor-pointer
            "
          >
            {suggestion}
          </button>
        ))}
      </div>

      <div
        className={`
          relative flex items-center h-14 rounded-[30px] px-5
          border transition-colors duration-500
          ${focused ? 'border-dawn-gold' : 'border-ridge-blue/20'}
        `}
        style={{
          backgroundColor: focused ? 'rgba(244,245,243,0.5)' : 'rgba(244,245,243,0.35)',
          backdropFilter: 'blur(6px)',
          boxShadow: focused
            ? '0 0 0 4px rgba(212,184,150,0.08)'
            : 'inset 0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="写下你的困惑，问道智慧"
          disabled={disabled}
          className="flex-1 bg-transparent text-ink placeholder:text-shadow-gray/60 text-base outline-none"
          maxLength={500}
        />

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className={`
            flex items-center justify-center w-10 h-10 rounded-full
            transition-all duration-300
            ${value.trim() && !disabled
              ? 'bg-ink text-cloud-white hover:bg-ink/85 cursor-pointer'
              : 'bg-mist-gray/30 text-ridge-blue/40 cursor-not-allowed'
            }
          `}
          aria-label="问道"
        >
          <ArrowRight size={18} weight="bold" />
        </button>
      </div>
    </motion.div>
  )
}

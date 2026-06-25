'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

const PHRASES = [
  '问道于老子...',
  '翻阅八十一章...',
  '匹配最相关的智慧...',
  '解读中...',
]

/**
 * 问道加载态
 *
 * 轮播短语 + 淡入淡出，替代裸 spinner
 * 5 秒后显示"仍在思考..."安慰语
 */
export default function DaoLoading() {
  const [index, setIndex] = useState(0)
  const [showWait, setShowWait] = useState(false)

  useEffect(() => {
    const phraseTimer = setInterval(() => {
      setIndex((i) => (i + 1) % PHRASES.length)
    }, 2000)

    const waitTimer = setTimeout(() => setShowWait(true), 5000)

    return () => {
      clearInterval(phraseTimer)
      clearTimeout(waitTimer)
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      {/* 旋转环（比 spinner 更安静） */}
      <motion.div
        className="w-8 h-8 rounded-full border-2 border-mist-gray/40 border-t-ink/30"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
      />

      {/* 轮播短语 */}
      <motion.p
        key={index}
        initial={{ opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="text-[13px] text-shadow-gray/50 tracking-wider"
      >
        {PHRASES[index]}
      </motion.p>

      {/* 超时安慰 */}
      {showWait && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] text-shadow-gray/30 tracking-wider"
        >
          仍在思考，请稍候...
        </motion.p>
      )}
    </div>
  )
}

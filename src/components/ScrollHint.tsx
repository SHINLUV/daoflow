'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CaretDown } from '@phosphor-icons/react'

/**
 * 向下滚动提示
 *
 * 规格:
 *   屏幕底部居中，极简向下箭头（线性）
 *   透明度 50%
 *   上下浮动周期 2 秒，幅度 4px
 *   用户滚动后自动淡出消失
 */
export default function ScrollHint() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) setHidden(true)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 4, 0] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <CaretDown size={20} className="text-ink/50" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

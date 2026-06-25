'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence, type MotionValue } from 'framer-motion'

/**
 * 云海背景 — 水墨多层视差版
 *
 * 层次:
 *   1. 宣纸基底色
 *   2. 主背景 — Agnes AI 生成水墨云海 (bg-ink-mountain.jpg, multiply 混合)
 *   3. 山脊层 x3 (随机显隐，显3s / 隐8s / 间隔7-22s 不规律)
 *   4. 云层漂移 x2 (25-35s 非匀速)
 *
 * 支持 Screen 1→2 过渡（云雾增厚再消散）
 */
interface CloudBackgroundProps {
  fogIntensity?: MotionValue<number> // MotionValue 0-1, 外部控制云雾厚度
}

export default function CloudBackground({ fogIntensity }: CloudBackgroundProps) {
  // 山脊显隐状态
  const [ridgeVisible, setRidgeVisible] = useState<boolean[]>([false, false, false])

  // 随机山脊显隐循环
  const scheduleRidge = useCallback((index: number) => {
    const showDelay = 7000 + Math.random() * 30000  // 7-22s 隐
    const hideTimer = setTimeout(() => {
      setRidgeVisible(prev => {
        const next = [...prev]
        next[index] = true
        return next
      })
      // 显示 3s 后开始隐
      const showTimer = setTimeout(() => {
        setRidgeVisible(prev => {
          const next = [...prev]
          next[index] = false
          return next
        })
        // 隐 8s 后安排下一次
        const hideTimer2 = setTimeout(() => {
          scheduleRidge(index)
        }, 8000)
        return () => clearTimeout(hideTimer2)
      }, 3000)
      return () => clearTimeout(showTimer)
    }, showDelay)
    return () => clearTimeout(hideTimer)
  }, [])

  useEffect(() => {
    const cleaners = [0, 1, 2].map(i => scheduleRidge(i))
    return () => cleaners.forEach(c => c())
  }, [scheduleRidge])

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* 层 1: 宣纸基底 */}
      <div className="absolute inset-0 bg-cloud-white" />

      {/* 层 2: 主背景 — Agnes AI 生成水墨云海 */}
      <div
        className="absolute inset-0 w-full h-full"
        style={{
          backgroundImage: 'url(/bg-ink-mountain.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center bottom',
          backgroundRepeat: 'no-repeat',
          mixBlendMode: 'multiply',
          opacity: 0.75,
        }}
      />

      {/* 层 3: 山脊显隐 */}
      {/* 山脊 1 — 远景 */}
      <AnimatePresence>
        {ridgeVisible[0] && (
          <motion.div
            className="absolute bottom-0 left-0 w-full h-[35%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          >
            <div
              className="w-full h-full"
              style={{
                background: 'linear-gradient(to top, rgba(90,100,105,0.6) 0%, rgba(120,130,135,0.2) 40%, transparent 100%)',
                maskImage: 'url("data:image/svg+xml,' + encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" preserveAspectRatio="none"><path d="M0,300 L0,200 Q120,120 240,180 Q360,100 480,160 Q600,80 720,140 Q840,90 960,150 Q1080,110 1200,170 L1200,300 Z" fill="white"/></svg>'
                ) + '")',
                WebkitMaskImage: 'url("data:image/svg+xml,' + encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" preserveAspectRatio="none"><path d="M0,300 L0,200 Q120,120 240,180 Q360,100 480,160 Q600,80 720,140 Q840,90 960,150 Q1080,110 1200,170 L1200,300 Z" fill="white"/></svg>'
                ) + '")',
                maskSize: '100% 100%',
                WebkitMaskSize: '100% 100%',
                filter: 'blur(12px)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 山脊 2 — 中景 */}
      <AnimatePresence>
        {ridgeVisible[1] && (
          <motion.div
            className="absolute bottom-0 left-0 w-full h-[28%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          >
            <div
              className="w-full h-full"
              style={{
                background: 'linear-gradient(to top, rgba(70,80,82,0.5) 0%, rgba(100,110,108,0.15) 35%, transparent 100%)',
                maskImage: 'url("data:image/svg+xml,' + encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" preserveAspectRatio="none"><path d="M0,240 L0,180 Q200,140 400,160 Q600,120 800,150 Q1000,100 1200,140 L1200,240 Z" fill="white"/></svg>'
                ) + '")',
                WebkitMaskImage: 'url("data:image/svg+xml,' + encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 240" preserveAspectRatio="none"><path d="M0,240 L0,180 Q200,140 400,160 Q600,120 800,150 Q1000,100 1200,140 L1200,240 Z" fill="white"/></svg>'
                ) + '")',
                maskSize: '100% 100%',
                WebkitMaskSize: '100% 100%',
                filter: 'blur(10px)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 山脊 3 — 近景重影 */}
      <AnimatePresence>
        {ridgeVisible[2] && (
          <motion.div
            className="absolute bottom-0 left-0 w-full h-[22%]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.12 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          >
            <div
              className="w-full h-full"
              style={{
                background: 'linear-gradient(to top, rgba(50,55,58,0.55) 0%, rgba(80,85,88,0.1) 30%, transparent 100%)',
                maskImage: 'url("data:image/svg+xml,' + encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 200" preserveAspectRatio="none"><path d="M0,200 L0,160 Q250,100 500,140 Q750,90 1000,130 Q1100,100 1200,120 L1200,200 Z" fill="white"/></svg>'
                ) + '")',
                WebkitMaskImage: 'url("data:image/svg+xml,' + encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 200" preserveAspectRatio="none"><path d="M0,200 L0,160 Q250,100 500,140 Q750,90 1000,130 Q1100,100 1200,120 L1200,200 Z" fill="white"/></svg>'
                ) + '")',
                maskSize: '100% 100%',
                WebkitMaskSize: '100% 100%',
                filter: 'blur(8px)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 层 4: 云层漂移 */}
      {/* 云层 A — 高层慢速 */}
      <motion.div
        className="absolute top-[8%] left-0 w-[200%] h-[30%]"
        animate={{ x: ['-50%', '0%', '-50%'] }}
        transition={{ duration: 35, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-full h-full"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(246,244,241,0.45) 0%, transparent 60%)',
            filter: 'blur(40px)',
          }}
        />
      </motion.div>

      {/* 云层 B — 低层快速 */}
      <motion.div
        className="absolute top-[18%] left-0 w-[250%] h-[25%]"
        animate={{ x: ['0%', '-60%', '0%'] }}
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div
          className="w-full h-full"
          style={{
            background: 'radial-gradient(ellipse 55% 45% at 25% 50%, rgba(201,205,200,0.28) 0%, transparent 55%)',
            filter: 'blur(50px)',
          }}
        />
      </motion.div>

      {/* 层 5: 云雾增厚层（Screen 1→2 过渡用） */}
      <motion.div
        className="absolute inset-0"
        style={{
          opacity: fogIntensity,
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(201,205,200,0.5) 0%, transparent 70%)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

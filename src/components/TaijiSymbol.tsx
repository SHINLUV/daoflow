'use client'

import { motion } from 'framer-motion'

/**
 * 太极符号 — 纯 CSS/SVG 绘制版
 *
 * 规格:
 *   尺寸: 屏高 35-40%
 *   透明度: 75-85%（清晰可辨，雾气感）
 *   边缘: 4-8px 高斯模糊羽化
 *   保留: 传统两仪点（黑侧浅点、白侧深点）
 *   动效: 自旋转 20s（呼吸式）+ 明暗呼吸 6s
 *
 * 色值:
 *   太极阴: #1A1B1E
 *   太极阳: #F4F5F3
 */
export default function TaijiSymbol() {
  return (
    <motion.div
      className="relative mx-auto"
      style={{
        width: 'min(40vh, 40vw, 500px)',
        height: 'min(40vh, 40vw, 500px)',
      }}
      animate={{
        rotate: [0, 360],
        opacity: [0.75, 0.85, 0.75],
      }}
      transition={{
        rotate: {
          duration: 20,
          repeat: Infinity,
          ease: [0.4, 0, 0.6, 1], // 非匀速呼吸式
        },
        opacity: {
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      }}
    >
      {/* SVG 太极图 */}
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: 'blur(4px)', // 羽化边缘
        }}
      >
        <defs>
          {/* 太极阴渐变（用于噪点纹理感） */}
          <radialGradient id="yin-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2a2b2e" />
            <stop offset="100%" stopColor="#1A1B1E" />
          </radialGradient>
          <radialGradient id="yang-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#F4F5F3" />
          </radialGradient>
        </defs>

        {/* 大圆底 */}
        <circle cx="100" cy="100" r="98" fill="url(#yang-grad)" />

        {/* 右半：阴（黑色）*/}
        <path
          d="M 100 2
             A 98 98 0 0 1 100 198
             A 49 49 0 0 0 100 100
             A 49 49 0 0 1 100 2 Z"
          fill="url(#yin-grad)"
        />

        {/* 上圆：阴中套阳点（白侧深点）*/}
        <circle cx="100" cy="50" r="24" fill="url(#yang-grad)" />

        {/* 下圆：阳中套阴点（黑侧白点）*/}
        <circle cx="100" cy="150" r="24" fill="url(#yin-grad)" />

        {/* 两仪点（传统太极眼）*/}
        <circle cx="100" cy="50" r="6" fill="#1A1B1E" />    {/* 阳中阴点 */}
        <circle cx="100" cy="150" r="6" fill="#F4F5F3" />    {/* 阴中阳点 */}
      </svg>
    </motion.div>
  )
}

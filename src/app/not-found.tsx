'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import NavBar from '@/components/NavBar'
import CloudBackground from '@/components/CloudBackground'

/**
 * 自定义 404 页面
 * 匹配 DaoFlow 设计语言：安静、留白、不责备
 */
export default function NotFound() {
  return (
    <div className="relative min-h-screen bg-cloud-white flex flex-col">
      <CloudBackground />
      <NavBar />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="text-[80px] text-ink/15 leading-none mb-6 font-serif">
            无
          </p>
          <p className="text-sm text-shadow-gray/60 tracking-wider mb-2">
            此页无名，天地之始
          </p>
          <p className="text-[13px] text-shadow-gray/40 tracking-wider mb-10">
            你所寻之路，尚未成形
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 rounded-full text-[13px] tracking-wider text-ridge-blue/60 hover:text-ink/80 border border-ridge-blue/10 hover:border-ridge-blue/25 transition-all"
          >
            返回问道
          </Link>
        </motion.div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'
import NavBar from '@/components/NavBar'
import CloudBackground from '@/components/CloudBackground'
import DaoLoading from '@/components/DaoLoading'
import { CaretLeft, CaretRight } from '@phosphor-icons/react'

interface ChapterData {
  id: number
  originalText: string
  vernacularText: string
  prevId: number
  nextId: number
}

/**
 * 章节阅读页
 *
 * 展示：原文 + 白话译文 + 前/后章节导航
 * 设计：极简阅读体验，留白为主
 */
export default function ChapterPage() {
  const params = useParams()
  const id = params.id as string
  const [chapter, setChapter] = useState<ChapterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/chapters/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('章节不存在')
        return r.json()
      })
      .then((data) => {
        setChapter(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  return (
    <div className="relative min-h-screen bg-cloud-white">
      <CloudBackground />
      <NavBar />

      <div className="relative z-10 max-w-[640px] mx-auto px-6 pt-32 pb-20">
        {/* 返回 */}
        <Link
          href="/"
          className="inline-block text-[13px] text-shadow-gray hover:text-ink transition-colors duration-300 mb-16 tracking-wider"
        >
          ← 返回问道
        </Link>

        {loading && <DaoLoading />}

        {error && (
          <div className="text-center py-20">
            <p className="text-ink/60 text-sm tracking-wider">{error}</p>
            <Link href="/" className="text-[13px] text-ridge-blue hover:text-ink transition-colors mt-4 inline-block">
              回到首页
            </Link>
          </div>
        )}

        {chapter && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* 章节标题 */}
            <span className="text-[12px] tracking-widest text-dawn-gold uppercase">
              第{chapter.id}章
            </span>

            {/* 原文 */}
            <blockquote className="mt-8 text-[20px] sm:text-[22px] text-ink/85 leading-[2.2] tracking-wider font-serif">
              {chapter.originalText}
            </blockquote>

            {/* 分隔 */}
            <div className="mt-10 mb-8 h-px bg-mist-gray/25" />

            {/* 白话译文 */}
            <h3 className="text-[12px] tracking-wider text-shadow-gray/50 mb-4 uppercase">
              白话译文
            </h3>
            <p className="text-[16px] text-ink/70 leading-[2] tracking-wider">
              {chapter.vernacularText}
            </p>

            {/* 前后导航 */}
            <div className="mt-16 flex items-center justify-between">
              {chapter.prevId > 0 ? (
                <Link
                  href={`/chapters/${chapter.prevId}`}
                  className="flex items-center gap-1.5 text-[13px] text-shadow-gray hover:text-ink transition-colors tracking-wider"
                >
                  <CaretLeft size={14} />
                  第{chapter.prevId}章
                </Link>
              ) : (
                <span />
              )}

              {chapter.nextId > 0 ? (
                <Link
                  href={`/chapters/${chapter.nextId}`}
                  className="flex items-center gap-1.5 text-[13px] text-shadow-gray hover:text-ink transition-colors tracking-wider"
                >
                  第{chapter.nextId}章
                  <CaretRight size={14} />
                </Link>
              ) : (
                <span />
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

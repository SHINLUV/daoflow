'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useScroll, useTransform } from 'framer-motion'
import NavBar from '@/components/NavBar'
import CloudBackground from '@/components/CloudBackground'
import TaijiSymbol from '@/components/TaijiSymbol'
import AskInput from '@/components/AskInput'
import DailyQuote from '@/components/DailyQuote'
import ScrollHint from '@/components/ScrollHint'
import ThemeMap from '@/components/ThemeMap'

/**
 * DaoFlow 首页
 *
 * Screen 1: 问道入口
 *   背景云海 → 太极 → 中央文案 → 输入框 → 今日一句 → 滚动提示
 * Screen 2: 主题地图（滚动后触发）
 *   过渡: 上移 800ms，云雾短暂增厚再消散
 */
export default function HomePage() {
  const router = useRouter()

  // Screen 1→2 过渡：监听滚动，云雾增厚再消散
  const { scrollY } = useScroll()
  // 用固定像素阈值避免 SSR 中 window 不可用
  const fogIntensity = useTransform(scrollY, [0, 300, 800], [0, 0.35, 0])

  const handleAsk = (question: string) => {
    router.push(`/ask?q=${encodeURIComponent(question)}`)
  }

  return (
    <>
      {/* Screen 1: 问道入口 */}
      <main className="relative min-h-screen flex flex-col overflow-hidden">
        <CloudBackground fogIntensity={fogIntensity} />
        <NavBar />

        {/* 太极 — 绝对定位在背景层，不影响文字排版 */}
        <div className="absolute inset-0 flex items-center justify-center z-[1] pointer-events-none">
          <TaijiSymbol />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1 gap-0">
          {/* 每日钩子：今日一句 — 用户打开即获得价值 */}
          <div className="mb-10">
            <DailyQuote />
          </div>

          {/* 中央文案：超级力量 — 邀请而非命令 */}
          <motion.div
            className="mb-10 text-center"
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.4] tracking-wider-title text-ink/80">
              此刻，
            </p>
            <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl leading-[1.4] tracking-wider-title text-ink/80">
              你遇到了什么？
            </p>
          </motion.div>

          {/* 输入框 */}
          <div className="mb-10">
            <Suspense fallback={null}>
              <AskInput onSubmit={handleAsk} />
            </Suspense>
          </div>
        </div>

        {/* 向下滚动提示 */}
        <ScrollHint />
      </main>

      {/* Screen 2: 主题地图 */}
      <ThemeMap />

      {/* Screen 3: 关于 — 极简底部 */}
      <section
        id="about"
        className="relative min-h-screen flex flex-col items-center justify-center px-6 py-24"
      >
        <CloudBackground />
        <div className="relative z-10 max-w-lg mx-auto text-center">
          {/* 标题 */}
          <h2 className="text-xl tracking-wider-title text-ink/75 mb-16">关于</h2>

          {/* 三段 */}
          <div className="flex flex-col gap-12">
            <div>
              <h3 className="text-sm tracking-wider text-shadow-gray/50 mb-3">老子是谁</h3>
              <p className="text-sm text-ink/60 leading-relaxed tracking-wider">
                春秋时期的哲学家，《道德经》的作者。
                他的思想影响了中国两千多年，
                是全球翻译量仅次于《圣经》的经典。
              </p>
            </div>

            <div>
              <h3 className="text-sm tracking-wider text-shadow-gray/50 mb-3">问道是什么</h3>
              <p className="text-sm text-ink/60 leading-relaxed tracking-wider">
                一个安静的地方。
                用《道德经》的古老智慧回应你此刻的困惑。
                不是国学课，不是资料库，是你与道的对话。
              </p>
            </div>

            <div>
              <h3 className="text-sm tracking-wider text-shadow-gray/50 mb-3">为什么做</h3>
              <p className="text-sm text-ink/60 leading-relaxed tracking-wider">
                在算法与信息洪流的时代，
                需要一个「慢」的空间。
                不是看见道，是看见自己站在道之中。
              </p>
            </div>
          </div>

        </div>
      </section>
    </>
  )
}

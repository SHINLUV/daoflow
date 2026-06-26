'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import {
  Heart, Handshake, Compass, Briefcase, Sparkle, YinYang
} from '@phosphor-icons/react'

/**
 * Screen 2 — 主题地图
 *
 * 规格（去卡片化）:
 *   纯文字列表，1px 发丝线分隔
 *   不使用卡片背景色块、投影、圆形图标背景
 *   线性图标可选，单色不填充
 *   每项留白 ≥32px
 *
 * 点击行为:
 *   跳回首页并预填一个与主题相关的问题
 */

const THEME_ICONS: Record<string, React.ElementType> = {
  '焦虑与情绪': Heart,
  '关系与边界': Handshake,
  '选择与决策': Compass,
  '事业与创业': Briefcase,
  '成长与自我': Sparkle,
  '无为与有为': YinYang,
}

const THEMES = [
  { name: '焦虑与情绪', subtitle: '如何面对内心的不安', question: '最近总是很焦虑，停不下来' },
  { name: '关系与边界', subtitle: '如何建立健康的关系', question: '和某人的关系让我很困扰' },
  { name: '选择与决策', subtitle: '如何做出明智的选择', question: '面临一个重要的选择，不知道怎么办' },
  { name: '事业与创业', subtitle: '如何在工作中找到方向', question: '工作中找不到方向和意义' },
  { name: '成长与自我', subtitle: '如何成为更好的自己', question: '感觉自己停滞不前，想成长' },
  { name: '无为与有为', subtitle: '如何平衡行动与等待', question: '不知道该努力还是该顺其自然' },
]

export default function ThemeMap() {
  const router = useRouter()

  const handleThemeClick = (question: string) => {
    router.push(`/?q=${encodeURIComponent(question)}`)
  }

  return (
    <section id="themes" className="relative min-h-screen px-8 py-section-gap">
      {/* 云雾过渡层 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(244,245,243,0.95) 0%, rgba(244,245,243,0.3) 30%, transparent 100%)',
        }}
      />

      <div className="relative z-10 max-w-[960px] mx-auto pt-20">
        {/* 区块标题 */}
        <div className="mb-16">
          <h2 className="title-sans text-lg tracking-[0.1em] text-ink mb-2 font-medium">
            主题
          </h2>
          <p className="text-[13px] text-shadow-gray">
            从人生议题出发，找到你的答案
          </p>
        </div>

        {/* 主题列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
          {THEMES.map((theme, index) => {
            const Icon = THEME_ICONS[theme.name]
            return (
              <motion.button
                key={theme.name}
                onClick={() => handleThemeClick(theme.question)}
                className="group flex items-start gap-4 py-10 border-t border-mist-gray/30 hover:border-mist-gray/60 transition-colors duration-500 text-left w-full cursor-pointer"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                {/* 线性图标（单色，不填充，不加背景色块） */}
                <Icon
                  size={22}
                  weight="light"
                  className="text-ridge-blue/60 mt-0.5 flex-shrink-0 group-hover:text-ink/70 transition-colors duration-500"
                />

                {/* 文字区域 */}
                <div className="flex flex-col gap-2">
                  <span className="text-[18px] tracking-wider text-ink group-hover:text-ink/80 transition-colors duration-300">
                    {theme.name}
                  </span>
                  <span className="text-[13px] text-shadow-gray/80 leading-relaxed">
                    {theme.subtitle}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

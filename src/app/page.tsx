'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, ArrowRight, ArrowDown, Sun, Waves, Plant, Copy, Check, Pause, Play } from '@phosphor-icons/react'
import NavBar from '@/components/NavBar'

const THEMES = [
  { name: '焦虑与情绪', description: '让纷扰沉淀，听见内心的声音。', question: '最近总是很焦虑，停不下来', word: '静', chapter: 16, excerpt: '致虚极，守静笃。', reflection: '不急着消除所有情绪。先给自己一点安静，看看此刻真正需要的是什么。' },
  { name: '关系与边界', description: '亲近他人，也安放好自己。', question: '和某人的关系让我很困扰', word: '和', chapter: 8, excerpt: '上善若水。', reflection: '温柔可以是一种力量。关照他人的同时，也为自己的感受留出位置。' },
  { name: '选择与决策', description: '在进退之间，找到自己的方向。', question: '面临一个重要的选择，不知道怎么办', word: '择', chapter: 44, excerpt: '知足不辱，知止不殆，可以长久。', reflection: '先分清想要的与需要的。一个适合自己的选择，往往始于知道什么已经足够。' },
  { name: '事业与创业', description: '有所作为，也有所不为。', question: '工作中找不到方向和意义', word: '行', chapter: 64, excerpt: '千里之行，始于足下。', reflection: '把遥远的目标放回眼前。今天能够认真完成的一小步，也是在向前。' },
  { name: '成长与自我', description: '向内看见，属于自己的力量。', question: '感觉自己停滞不前，想成长', word: '生', chapter: 33, excerpt: '知人者智，自知者明。', reflection: '暂时放下与他人的比较。看清自己的节奏，才能决定下一步往哪里走。' },
  { name: '无为与有为', description: '像水一样，找到行动的节奏。', question: '不知道该努力还是该顺其自然', word: '流', chapter: 48, excerpt: '为学日益，为道日损。', reflection: '不必用更多行动回应每一种不安。试着减去一件消耗自己的事，把力气留给真正重要的方向。' },
]
interface Quote { quote: string; chapterId: number; attribution: string; date?: string }
const FALLBACK_QUOTE: Quote = { quote: '上善若水，水善利万物而不争。', chapterId: 8, attribution: '《道德经·第八章》' }

export default function HomePage() {
  const router = useRouter()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [question, setQuestion] = useState('')
  const [quote, setQuote] = useState<Quote>(FALLBACK_QUOTE)
  const [dailyAvailable, setDailyAvailable] = useState(false)
  const [copyState, setCopyState] = useState('')
  const [paused, setPaused] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTheme, setActiveTheme] = useState(0)
  const theme = THEMES[activeTheme]

  useEffect(() => {
    if (!copyState) return
    const timer = window.setTimeout(() => setCopyState(''), 4000)
    return () => window.clearTimeout(timer)
  }, [copyState])

  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('q')
    if (prefill) setQuestion(prefill.slice(0, 500))
    const controller = new AbortController()
    fetch('/api/daily-quote', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('quote unavailable'); return r.json() })
      .then(data => {
        if (typeof data.quote === 'string' && Number.isInteger(data.chapterId)) {
          setQuote(data)
          setDailyAvailable(true)
        }
      }).catch(() => {})
    return () => controller.abort()
  }, [])

  function prefill(value: string) {
    setQuestion(value)
    inputRef.current?.focus({ preventScroll: true })
    document.getElementById('ask-form')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    if (!question.trim() || submitting) return
    setSubmitting(true)
    router.push(`/ask?q=${encodeURIComponent(question.trim())}`)
  }
  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(`${quote.quote}\n—— ${quote.attribution}`)
      setCopyState('已复制')
    } catch { setCopyState('复制失败，请手动选择文字') }
  }

  return (
    <div className="dao-home">
      <NavBar />
      <main id="main-content">
        <section className="dao-hero dao-container" aria-labelledby="hero-title">
          <div className="dao-hero-copy">
            <div className="dao-eyebrow"><span className="dao-small-line" /> 道法自然 · 回到自己</div>
            <h1 id="hero-title">让心归静，<br /><span>让生活顺流。</span></h1>
            <p className="dao-hero-english">Find your own flow.</p>
            <p className="dao-hero-description">生活有时太吵，答案不必急着找。<br />借《道德经》的智慧，重新看见此刻的自己。</p>
            <form id="ask-form" className="dao-ask-form" onSubmit={submit}>
              <label htmlFor="dao-question">此刻，什么让你挂心？</label>
              <textarea id="dao-question" ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)} maxLength={500} rows={2} placeholder="写下你的困惑，让思绪慢慢展开……" aria-describedby="question-help" />
              <div className="dao-form-bottom">
                <span id="question-help">{question.length ? `${question.length} / 500` : '从一个真实的问题开始'}</span>
                <button className="dao-primary" type="submit" disabled={!question.trim() || submitting}>{submitting ? '正在前往' : '问一问道'}<ArrowUpRight size={18} /></button>
              </div>
            </form>
            <div className="dao-suggestions"><span>试着问</span>{['最近有些焦虑', '不知道如何选择', '总是在意别人的看法'].map(text => <button key={text} onClick={() => prefill(text)}>{text}<ArrowUpRight size={12} /></button>)}</div>
          </div>
          <div className={`dao-hero-art ${paused ? 'is-paused' : ''}`}>

            <div className="dao-landscape">
              <Image src="/daoflow-valley.png" alt="薄雾环绕山峦，松林之间的河流缓缓转弯" fill priority sizes="(max-width: 760px) 92vw, 47vw" quality={85} className="dao-landscape-image" />
              <div className="dao-landscape-shade" />
              <div className="dao-art-character" aria-hidden="true">道</div>
              <div className="dao-art-caption"><span>水善利万物而不争</span><small>《道德经》第八章</small></div>
              <div className="dao-art-bottom"><span><Waves size={17} /> 与万物同行</span><button type="button" onClick={() => setPaused(v => !v)} aria-label={paused ? '播放山水动效' : '暂停山水动效'} aria-pressed={paused}>{paused ? <Play size={15} /> : <Pause size={15} />}</button></div>
            </div>

            <div className="dao-art-foot"><span>静观万物，亦观自己。</span><span>山水之间 · 问道于心</span></div>
          </div>
        </section>

        <section className="dao-daily dao-container" aria-label={dailyAvailable ? '今日一句' : '经典一句'}>
          <div className="dao-daily-label"><Sun size={23} weight="light" /><div><span>{dailyAvailable ? '今日一句' : '经典一句'}</span><small>留一点时间，给自己</small></div></div>
          <div className="dao-daily-quote"><p>{quote.quote}</p><Link href={`/chapters/${quote.chapterId}`}>{quote.attribution}<ArrowUpRight size={13} /></Link></div>
          <button className="dao-copy" onClick={copyQuote} aria-label="复制今日一句">{copyState === '已复制' ? <Check size={18} /> : <Copy size={18} />}<span>{copyState || '留住这句话'}</span></button>
          <span className="dao-sr-only" role="status">{copyState}</span>
        </section>

        <section id="themes" className="dao-themes dao-container" aria-labelledby="themes-title">
          <div className="dao-section-heading"><div><span className="dao-eyebrow">从生活出发</span><h2 id="themes-title">每一种心境，都有回响。</h2></div><p>选一种此刻的心境，<br />读一句经典，再慢慢展开。<ArrowDown size={18} /></p></div>
          <div className="dao-theme-explorer">
            <div className="dao-theme-list" role="group" aria-label="选择人生主题">
              {THEMES.map((item, i) => <button type="button" className="dao-theme-row" key={item.name} aria-pressed={activeTheme === i} aria-controls="theme-preview" onClick={() => setActiveTheme(i)}>
                <span className="dao-theme-index">0{i + 1}</span>
                <span className="dao-theme-row-copy"><strong>{item.name}</strong><span>{item.description}</span></span>
                <span className="dao-theme-selection">{activeTheme === i ? <Check size={19} /> : <ArrowUpRight size={19} />}</span>
              </button>)}
            </div>
            <article id="theme-preview" className="dao-theme-preview" aria-label="主题篇章预览">
              <div className="dao-theme-image"><Image src="/daoflow-still-water.webp" unoptimized alt="青苔石静立水中，细微涟漪向外舒展" fill sizes="(max-width: 760px) 90vw, 45vw" /><span aria-hidden="true">{theme.word}</span></div>
              <div className="dao-theme-preview-copy">
                <div aria-live="polite" aria-atomic="true">
                  <span className="dao-eyebrow">{theme.name} · 一章启发</span>
                  <blockquote>{theme.excerpt}</blockquote>
                  <Link href={`/chapters/${theme.chapter}`} className="dao-chapter-source">《道德经》第 {theme.chapter} 章 · 阅读原文<ArrowUpRight size={14} /></Link>
                  <p>{theme.reflection}</p>
                </div>
                <button type="button" className="dao-primary" onClick={() => prefill(theme.question)}>用这个主题问道<ArrowUpRight size={18} /></button>
              </div>
            </article>
          </div>
        </section>

        <section id="about" className="dao-about dao-container" aria-labelledby="about-title">
          <div className="dao-about-manifesto">
            <span className="dao-eyebrow">THE WAY TO YOUR OWN FLOW</span>
            <p>少一点纷扰，<br />多一点自己。</p>
            <div className="dao-brand-equation"><span>道<small>看见自然的规律</small></span><span aria-hidden="true">＋</span><span>Flow<small>找到自己的节奏</small></span></div>
            <span className="dao-manifesto-foot"><Waves size={21} weight="light" />不急于答案，先打开一种看法。</span>
          </div>
          <div className="dao-about-copy"><span className="dao-eyebrow">关于 DaoFlow</span><h2 id="about-title">古老的智慧，<br />照见今天的生活。</h2><p>「道」是万物自然的规律，<br />「Flow」是顺应自己、从容前行的状态。</p><p>我们把《道德经》带回日常。以你的困惑为起点，<br className="dao-desktop-break" />由 AI 连接相关篇章，陪你读懂原文，也读懂自己。</p><Link href="/chapters/1" className="dao-text-link">从第一章，慢慢读起<ArrowRight size={19} /></Link><div className="dao-about-note"><Plant size={19} weight="light" />答案之外，还有另一种看问题的方式。</div></div>
        </section>
      </main>
    </div>
  )
}

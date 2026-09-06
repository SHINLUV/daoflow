'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowUpRight, Copy, Check, ArrowClockwise } from '@phosphor-icons/react'
import NavBar from '@/components/NavBar'
import CloudBackground from '@/components/CloudBackground'
import DaoLoading from '@/components/DaoLoading'

interface AskResult {
  matchedChapter: number
  originalText: string | null
  interpretation: string
  followUpQuestion: string | null
  sessionId: string | null
  meta: { provider: string; degraded: boolean }
}
function AskContent() {
  const searchParams = useSearchParams()
  const question = searchParams.get('q') || ''
  const [result, setResult] = useState<AskResult | null>(null)
  const [loading, setLoading] = useState(!!question)
  const [error, setError] = useState('')
  const [copyState, setCopyState] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!question) { setLoading(false); return }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    setLoading(true)
    setError('')
    setResult(null)
    setCopyState('')
    let active = true
    fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }), signal: controller.signal })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || '服务暂时未能回应，请稍后重试。')
        if (!data.meta || typeof data.interpretation !== 'string') throw new Error('未能读取回答，请再试一次。')
        return data
      })
      .then(data => { if (active) setResult(data) })
      .catch(err => { if (active) setError(err.name === 'AbortError' ? '这次等待有些久。你可以重试，或先读一章原文。' : err.message) })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [question, attempt])

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText([`问：${question}`, `《道德经·第${result.matchedChapter}章》`, result.originalText, result.interpretation, result.followUpQuestion].filter(Boolean).join('\n\n'))
      setCopyState('已复制')
    } catch { setCopyState('复制失败，请手动选择文字') }
  }

  return <div className="relative min-h-screen">
    <CloudBackground /><NavBar />
    <main id="main-content" className="dao-reader">
      <Link href={question ? `/?q=${encodeURIComponent(question)}` : '/'} className="dao-back"><ArrowLeft size={15} />返回问道</Link>
      <div className="dao-eyebrow">与道对话</div>
      <h1>{question ? '换一个角度，看见自己。' : '从你的困惑，开始。'}</h1>
      {question && <p className="dao-question-display">{question}</p>}
      {!question && <div className="dao-error"><p>写下此刻挂心的事，让古老的智慧与你的生活相遇。</p><Link className="dao-primary" href="/">开始问道<ArrowUpRight size={17} /></Link></div>}
      {loading && <DaoLoading />}
      {error && <div className="dao-error" role="alert"><h2>暂时没有收到回应</h2><p>{error}</p><div className="dao-reader-actions"><button className="dao-primary" onClick={() => setAttempt(v => v + 1)}><ArrowClockwise size={16} />重试</button><Link href="/chapters/1">先读一章<ArrowRight size={16} /></Link></div></div>}
      {result && <>
        {result.meta.degraded && <p className="dao-status">本次为你呈现相关篇章与通用解读，未生成个性化回答。</p>}
        <article className="dao-reading-card">
          <div className="dao-eyebrow">道德经 · 与此刻相关的一章</div>
          <h2 style={{ marginTop: 16 }}>第{result.matchedChapter}章</h2>
          {result.originalText && <blockquote>{result.originalText}</blockquote>}
          {result.originalText && <div className="dao-reading-divider" />}
          <h3>{result.meta.degraded ? '篇章解读' : '回到你的生活'}</h3>
          <p className="dao-interpretation">{result.interpretation}</p>
          {result.followUpQuestion && <div className="dao-reflection"><span>留给自己的一个问题</span><p>{result.followUpQuestion}</p></div>}
        </article>
        <div className="dao-reader-actions">
          <Link href={`/chapters/${result.matchedChapter}`} className="dao-primary">完整阅读本章<ArrowUpRight size={17} /></Link>
          <Link href="/">继续问道<ArrowRight size={16} /></Link>
          <button onClick={copy}>{copyState === '已复制' ? <Check size={16} /> : <Copy size={16} />}{copyState || '复制回答'}</button>
        </div>
        <span className="dao-sr-only" role="status">{copyState}</span>
      </>}
    </main>
  </div>
}
export default function AskPage() {
  return <Suspense fallback={<DaoLoading />}><AskContent /></Suspense>
}

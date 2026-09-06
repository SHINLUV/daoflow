'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, ArrowClockwise } from '@phosphor-icons/react'
import NavBar from '@/components/NavBar'
import CloudBackground from '@/components/CloudBackground'
import DaoLoading from '@/components/DaoLoading'

interface ChapterData { id: number; originalText: string; vernacularText: string; prevId: number; nextId: number }
export default function ChapterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [chapter, setChapter] = useState<ChapterData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'both' | 'original'>('both')
  const [attempt, setAttempt] = useState(0)
  const valid = /^\d+$/.test(id) && +id >= 1 && +id <= 81

  useEffect(() => {
    setChapter(null)
    setError('')
    if (!valid) { setError('章节不存在，请选择第一至第八十一章。'); setLoading(false); return }
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    setLoading(true)
    fetch(`/api/chapters/${id}`, { signal: controller.signal })
      .then(async r => {
        if (!r.ok) throw new Error(r.status === 404 ? '暂时未找到本章内容，请稍后重试。' : '暂时无法读取篇章，请稍后重试。')
        return r.json()
      })
      .then(data => { if (active) setChapter(data) })
      .catch(err => { if (active) setError(err.name === 'AbortError' ? '篇章加载超时，请检查连接后重试。' : err.message) })
      .finally(() => { clearTimeout(timeout); if (active) setLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [id, attempt, valid])

  return <div className="relative min-h-screen"><CloudBackground /><NavBar />
    <main className="dao-reader" id="main-content">
      <Link href="/" className="dao-back"><ArrowLeft size={15} />返回问道</Link>
      <div className="dao-reader-top"><div><span className="dao-eyebrow">道德经 · 老子</span><h1>慢慢读，自有所得。</h1></div>
        <div className="dao-chapter-tools"><label htmlFor="chapter-select">篇章<select id="chapter-select" value={valid ? +id : ''} onChange={e => router.push(`/chapters/${e.target.value}`)}>{!valid && <option value="" disabled>请选择</option>}{Array.from({ length: 81 }, (_, i) => <option value={i + 1} key={i}>第 {i + 1} 章</option>)}</select></label></div>
      </div>
      <div className="dao-tab-list" aria-label="阅读模式"><button onClick={() => setView('both')} aria-pressed={view === 'both'}>原文与译文</button><button onClick={() => setView('original')} aria-pressed={view === 'original'}>只读原文</button></div>
      {loading && <DaoLoading />}
      {error && <div className="dao-error" role="alert"><h2>让我们稍后再读</h2><p>{error}</p>{valid && <button className="dao-primary" onClick={() => setAttempt(a => a + 1)}><ArrowClockwise size={16} />重新加载</button>}</div>}
      {chapter && <article className="dao-reading-card"><h2>第{chapter.id}章</h2><blockquote>{chapter.originalText}</blockquote>{view === 'both' && <><div className="dao-reading-divider" /><h3>白话译文</h3><p className="dao-interpretation">{chapter.vernacularText}</p></>}</article>}
      {valid && <nav className="dao-chapter-nav" aria-label="章节翻页">{+id > 1 ? <Link href={`/chapters/${+id - 1}`}><ArrowLeft size={16} />第{+id - 1}章</Link> : <span />}{+id < 81 && <Link href={`/chapters/${+id + 1}`}>第{+id + 1}章<ArrowRight size={16} /></Link>}</nav>}
    </main>
  </div>
}

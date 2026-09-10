'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PublicHallDto } from '@/lib/hall/contracts'
import styles from './hall.module.css'

type ApiError = { error?: { message?: string } }

export function HallClient() {
  const [items, setItems] = useState<PublicHallDto[]>([])
  const [chapter, setChapter] = useState('')
  const [theme, setTheme] = useState('')
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const initialLoadDone = useRef(false)

  const load = useCallback(async (cursor: string | null, replace: boolean) => {
    setState('loading')
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    if (chapter) params.set('chapter', chapter)
    if (theme.trim()) params.set('theme', theme.trim())
    try {
      const response = await fetch(`/api/hall?${params.toString()}`, { cache: 'no-store' })
      const payload = await response.json() as { items?: PublicHallDto[]; nextCursor?: string | null } & ApiError
      if (!response.ok || !Array.isArray(payload.items)) throw new Error(payload.error?.message || '大厅暂时无法读取。')
      setItems(previous => replace ? payload.items! : [...previous, ...payload.items!])
      setNextCursor(typeof payload.nextCursor === 'string' ? payload.nextCursor : null)
      setMessage(payload.items.length === 0 && replace ? '这里暂时还没有通过审核的匿名分享。' : '')
      setState('ready')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : '大厅暂时无法读取。')
    }
  }, [chapter, theme])

  useEffect(() => {
    if (initialLoadDone.current) return
    initialLoadDone.current = true
    void load(null, true)
  }, [load]) // Initial public read only; filters require an explicit action.

  return <main className={styles.shell} id="main-content">
    <p className={styles.eyebrow}>ANONYMOUS, REVIEWED, READ-ONLY</p>
    <h1 className={styles.title}>同道大厅</h1>
    <p className={styles.intro}>这里仅展示作者主动提交、经过审核的匿名问答。没有评论、私信或排行榜；公开内容不代表作者身份，也不替代专业支持。</p>
    <div className={styles.toolbar} aria-label="大厅筛选">
      <label className={styles.field}>章节
        <select value={chapter} onChange={event => setChapter(event.target.value)}>
          <option value="">全部章节</option>
          {Array.from({ length: 81 }, (_, index) => <option key={index + 1} value={index + 1}>第 {index + 1} 章</option>)}
        </select>
      </label>
      <label className={styles.field}>主题
        <input value={theme} maxLength={64} onChange={event => setTheme(event.target.value)} placeholder="例如：关系、取舍" />
      </label>
      <button className={styles.button} type="button" onClick={() => void load(null, true)}>应用筛选</button>
    </div>
    <div className={styles.actions}>
      <Link className={styles.secondaryButton} href="/hall/publish">匿名分享一条已保存的问道</Link>
      <Link className={styles.secondaryButton} href="/hall/mine">我的分享</Link>
    </div>
    <p className={`${styles.status} ${state === 'error' ? styles.error : ''}`} role="status">{state === 'loading' ? '正在寻找同道的分享…' : message}</p>
    <section className={styles.cards} aria-live="polite">
      {items.map(item => <article className={styles.card} key={item.publicId}>
        <div className={styles.meta}><span>同道</span><time dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleDateString('zh-CN')}</time><span>{item.providerLabel}</span></div>
        <h2>{item.question}</h2>
        <p>{item.answer.summary}</p>
        <div className={styles.meta}>{item.answer.citations.map(citation => <span key={citation.chunkId}>《道德经》第 {citation.chapter} 章</span>)}</div>
        <Link className={styles.link} href={`/hall/${item.publicId}`}>查看完整解读</Link>
      </article>)}
    </section>
    {nextCursor && <p className={styles.actions}><button className={styles.secondaryButton} type="button" onClick={() => void load(nextCursor, false)}>加载更多</button></p>}
  </main>
}

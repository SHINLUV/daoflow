'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { PublicHallDto } from '@/lib/hall/contracts'
import { errorMessage, mutationHeaders } from '../client'
import { PublicAnswer } from '../PublicAnswer'
import styles from '../hall.module.css'

export function HallDetailClient({ publicId }: { publicId: string }) {
  const [publication, setPublication] = useState<PublicHallDto | null>(null)
  const [message, setMessage] = useState('正在读取分享…')
  const [reason, setReason] = useState('privacy')
  const [note, setNote] = useState('')
  const [reportMessage, setReportMessage] = useState('')

  useEffect(() => {
    let active = true
    fetch(`/api/hall/${publicId}`, { cache: 'no-store' })
      .then(async response => ({ response, payload: await response.json() as { publication?: PublicHallDto } }))
      .then(({ response, payload }) => {
        if (!active) return
        if (!response.ok || !payload.publication) throw new Error('该分享不存在或已撤回。')
        setPublication(payload.publication)
        setMessage('')
      })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message : '该分享暂不可读取。') })
    return () => { active = false }
  }, [publicId])

  async function report(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setReportMessage('正在提交举报…')
    try {
      const response = await fetch(`/api/hall/${publicId}/reports`, {
        method: 'POST',
        headers: await mutationHeaders(),
        body: JSON.stringify({ reason, note }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, '举报未提交。'))
      setNote('')
      setReportMessage('已收到举报，内容不会公开展示。')
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : '举报未提交。')
    }
  }

  return <main className={styles.shell} id="main-content">
    <p className={styles.actions}><Link className={styles.link} href="/hall">返回同道大厅</Link></p>
    {!publication ? <p className={`${styles.status} ${styles.error}`} role="status">{message}</p> : <>
      <article className={styles.paper}>
        <div className={styles.meta}><span>同道</span><time dateTime={publication.publishedAt}>{new Date(publication.publishedAt).toLocaleString('zh-CN')}</time><span>{publication.providerLabel}</span></div>
        <h1 className={styles.title}>{publication.question}</h1>
        <PublicAnswer answer={publication.answer} />
      </article>
      <section className={styles.paper} aria-labelledby="report-title">
        <h2 id="report-title">举报这条公开内容</h2>
        <p className={styles.intro}>举报仅限已登录用户。举报理由、你的身份和原作者信息都不会公开。</p>
        <form className={styles.publishGrid} onSubmit={report}>
          <label className={styles.field}>原因<select value={reason} onChange={event => setReason(event.target.value)}><option value="privacy">可能泄露隐私</option><option value="abuse">辱骂或滥用</option><option value="unsafe">不安全内容</option><option value="copyright">版权问题</option><option value="other">其他</option></select></label>
          <label className={styles.field}>简要说明<textarea value={note} maxLength={500} required onChange={event => setNote(event.target.value)} /></label>
          <button className={styles.secondaryButton} type="submit">提交举报</button>
        </form>
        <p className={styles.status} role="status">{reportMessage}</p>
      </section>
    </>}
  </main>
}

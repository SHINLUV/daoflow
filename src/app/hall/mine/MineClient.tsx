'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { MyHallPublicationDto } from '@/lib/hall/contracts'
import { errorMessage, mutationHeaders } from '../client'
import styles from '../hall.module.css'

export function MineClient() {
  const [publications, setPublications] = useState<MyHallPublicationDto[]>([])
  const [message, setMessage] = useState('正在读取你的分享…')

  async function load() {
    try {
      const response = await fetch('/api/me/publications', { cache: 'no-store', credentials: 'same-origin' })
      const payload = await response.json().catch(() => null) as { publications?: MyHallPublicationDto[] }
      if (!response.ok || !Array.isArray(payload?.publications)) throw new Error(errorMessage(payload, '无法读取你的分享。'))
      setPublications(payload.publications)
      setMessage(payload.publications.length ? '' : '你还没有提交过匿名分享。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法读取你的分享。')
    }
  }

  useEffect(() => { void load() }, [])

  async function withdraw(publication: MyHallPublicationDto) {
    setMessage('正在撤回…')
    try {
      const response = await fetch(`/api/hall/${publication.publicId}/withdraw`, {
        method: 'POST', headers: await mutationHeaders(), body: JSON.stringify({ version: publication.version }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, '撤回未完成。'))
      setMessage('已撤回。公开源站会立即不可访问。')
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '撤回未完成。')
    }
  }

  return <main className={styles.shell} id="main-content">
    <p className={styles.actions}><Link className={styles.link} href="/hall">返回同道大厅</Link></p>
    <p className={styles.eyebrow}>PRIVATE MANAGEMENT</p>
    <h1 className={styles.title}>我的分享</h1>
    <p className={styles.intro}>这里的状态仅对你可见。任何已提交内容在审核通过前都不会出现在公共大厅。</p>
    <p className={styles.status} role="status">{message}</p>
    <section className={styles.cards}>
      {publications.map(publication => <article className={styles.card} key={publication.id}>
        <div className={styles.meta}><span>状态：{statusLabel(publication.status)}</span><time dateTime={publication.createdAt}>提交于 {new Date(publication.createdAt).toLocaleString('zh-CN')}</time>{publication.redacted && <span>已脱敏</span>}</div>
        <h2>{publication.question}</h2>
        {publication.status === 'published' && <Link className={styles.link} href={`/hall/${publication.publicId}`}>查看公开页</Link>}
        {publication.status !== 'withdrawn' && <button className={styles.secondaryButton} type="button" onClick={() => void withdraw(publication)}>撤回这条分享</button>}
      </article>)}
    </section>
  </main>
}

function statusLabel(status: MyHallPublicationDto['status']): string {
  return ({ pending: '待审核', published: '已公开', withdrawn: '已撤回', rejected: '未通过审核' })[status]
}

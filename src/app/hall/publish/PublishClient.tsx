'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { PublicAnswer, Redaction } from '@/lib/hall/contracts'
import { errorMessage, mutationHeaders } from '../client'
import { PublicAnswer as PublicAnswerView } from '../PublicAnswer'
import styles from '../hall.module.css'

type Preview = { sessionId: string; sourceHash: string; question: string; answer: PublicAnswer }

export function PublishClient() {
  const [sessionId, setSessionId] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [hiddenFields, setHiddenFields] = useState<Set<Redaction['field']>>(new Set())
  const [consent, setConsent] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [message, setMessage] = useState('')

  const questionRedactions = useMemo(() => preview && hiddenFields.has('question') ? [{ field: 'question', start: 0, end: preview.question.length }] : [], [hiddenFields, preview])
  const answerRedactions = useMemo(() => preview ? redactionsForAnswer(preview.answer, hiddenFields) : [], [hiddenFields, preview])

  async function loadPreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('正在读取可公开预览…')
    setPreview(null)
    try {
      const response = await fetch(`/api/me/publications/preview?sessionId=${encodeURIComponent(sessionId.trim())}`, { cache: 'no-store', credentials: 'same-origin' })
      const payload = await response.json().catch(() => null) as { preview?: Preview }
      if (!response.ok || !payload?.preview) throw new Error(errorMessage(payload, '无法读取这条已保存问道。'))
      setPreview(payload.preview)
      setHiddenFields(new Set())
      setConsent(false)
      setIdempotencyKey(crypto.randomUUID())
      setMessage('请核对公开文本；这里只能隐藏内容，不能改写后仍冒充原始 AI 回答。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法读取这条已保存问道。')
    }
  }

  function toggle(field: Redaction['field']) {
    setHiddenFields(previous => {
      const next = new Set(previous)
      if (next.has(field)) next.delete(field); else next.add(field)
      return next
    })
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!preview || !consent || !idempotencyKey) return
    setMessage('正在提交审核…')
    try {
      const response = await fetch('/api/hall/publications', {
        method: 'POST',
        headers: await mutationHeaders(),
        body: JSON.stringify({
          sessionId: preview.sessionId,
          sourceHash: preview.sourceHash,
          questionRedactions,
          answerRedactions,
          consent: true,
          idempotencyKey,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload, '提交未完成。'))
      setMessage('已提交为待审核。它不会自动公开；审核通过前仅你自己可在“我的分享”查看状态。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '提交未完成。')
    }
  }

  return <main className={styles.shell} id="main-content">
    <p className={styles.actions}><Link className={styles.link} href="/hall">返回同道大厅</Link></p>
    <p className={styles.eyebrow}>PRIVATE BY DEFAULT</p>
    <h1 className={styles.title}>匿名分享</h1>
    <p className={styles.intro}>只有已登录、邮箱已验证且由服务端验证为真实 Agnes 回答的已保存问道，才可进入预览。提交后默认待审核，不会自动公开。</p>
    <section className={styles.paper}>
      <form className={styles.compact} onSubmit={loadPreview}>
        <label className={styles.field}>已保存问道 ID<input value={sessionId} inputMode="text" autoComplete="off" placeholder="粘贴一条历史问道的 UUID" required onChange={event => setSessionId(event.target.value)} /></label>
        <button className={styles.button} type="submit">读取公开预览</button>
      </form>
      <p className={styles.notice}>不要在公开问题或回答中保留姓名、联系方式、地点、职业、第三方私密信息，或能够组合识别你的线索。公开后仍可能被截图或转载。</p>
      <p className={styles.status} role="status">{message}</p>
    </section>
    {preview && <section className={styles.paper}>
      <h2>公开预览与脱敏</h2>
      <p className={styles.intro}>勾选项会由服务器按原始快照做固定“[已隐去]”替换；模型来源、审核状态、作者和回答正文都不由浏览器提交。</p>
      <div className={styles.publishGrid}>
        <label className={styles.check}><input type="checkbox" checked={hiddenFields.has('question')} onChange={() => toggle('question')} />隐藏公开问题</label>
        {answerFields(preview.answer).map(field => <label className={styles.check} key={field}><input type="checkbox" checked={hiddenFields.has(field)} onChange={() => toggle(field)} />隐藏“{fieldLabel(field)}”整段</label>)}
      </div>
      <article className={styles.card}>
        <h2>{hiddenFields.has('question') ? '[已隐去]' : preview.question}</h2>
        <PublicAnswerView answer={redactForPreview(preview.answer, hiddenFields)} />
      </article>
      <form className={styles.publishGrid} onSubmit={submit}>
        <label className={styles.check}><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />我已检查公开内容，并明确同意将这个脱敏快照提交审核。</label>
        <button className={styles.button} disabled={!consent} type="submit">提交为待审核</button>
      </form>
    </section>}
  </main>
}

function answerFields(answer: PublicAnswer): Redaction['field'][] {
  return ['summary', 'interpretation', 'application', 'boundary', 'reflection', ...answer.actions.map((_, index) => `actions.${index}` as Redaction['field'])]
}

function redactionsForAnswer(answer: PublicAnswer, fields: Set<Redaction['field']>): Redaction[] {
  const actionFields: Array<[Redaction['field'], string]> = answer.actions.map((action, index) => [`actions.${index}` as Redaction['field'], action])
  const fieldsWithText: Array<[Redaction['field'], string]> = [
    ['summary', answer.summary], ['interpretation', answer.interpretation], ['application', answer.application], ['boundary', answer.boundary], ['reflection', answer.reflection],
    ...actionFields,
  ]
  return fieldsWithText.filter(([field]) => fields.has(field)).map(([field, value]) => ({ field, start: 0, end: value.length }))
}

function redactForPreview(answer: PublicAnswer, fields: Set<Redaction['field']>): PublicAnswer {
  return {
    ...answer,
    summary: fields.has('summary') ? '[已隐去]' : answer.summary,
    interpretation: fields.has('interpretation') ? '[已隐去]' : answer.interpretation,
    application: fields.has('application') ? '[已隐去]' : answer.application,
    boundary: fields.has('boundary') ? '[已隐去]' : answer.boundary,
    reflection: fields.has('reflection') ? '[已隐去]' : answer.reflection,
    actions: answer.actions.map((action, index) => fields.has(`actions.${index}`) ? '[已隐去]' : action),
  }
}

function fieldLabel(field: Redaction['field']): string {
  if (field.startsWith('actions.')) return `可以试试 ${Number(field.slice(8)) + 1}`
  return ({ summary: '看见困惑', interpretation: '照见此刻', application: '可以试试', boundary: '也看另一面', reflection: '反思问题' } as Record<string, string>)[field]
}

'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ArrowUpRight } from '@phosphor-icons/react'

type Result = { matchedChapter: number; originalText: string | null; interpretation: string; followUpQuestion: string | null; sessionId: string | null; meta: { provider: string; degraded: boolean; persistence: 'saved' | 'failed' | 'not_requested'; persistenceMessage?: string } }
type Handoff = { question?: string; sourceEntryId?: string; volumeId?: string }
const DRAFT_KEY = 'daoflow:ask:draft'
const ENTRY_HANDOFF_KEY = 'daoflow:ask:entry-handoff'

export default function AskPage() {
  const [question, setQuestion] = useState('')
  const [handoff, setHandoff] = useState<Handoff>({})
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const entry = readHandoff(sessionStorage.getItem(ENTRY_HANDOFF_KEY))
    const ordinary = readHandoff(sessionStorage.getItem(DRAFT_KEY))
    const selected = entry.question || entry.sourceEntryId ? entry : ordinary
    setQuestion(selected.question ?? '')
    setHandoff(selected)
    setReady(true)
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || trimmed.length > 500) { setMessage('请写下 1–500 字的问题。'); return }
    setPending(true); setMessage('')
    const requestId = crypto.randomUUID()
    // The question is intentionally handed over in sessionStorage, never in the URL.
    sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(ENTRY_HANDOFF_KEY)
    try {
      const response = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: trimmed, requestId, sourceEntryId: handoff.sourceEntryId ?? null, volumeId: handoff.volumeId ?? null }) })
      const data = await response.json()
      if (response.status === 202) { setMessage('正在生成回答，请稍候再试。'); return }
      if (!response.ok) { setMessage(data.error?.message ?? '暂时无法回应，请保留问题后重试。'); return }
      setResult(data as Result)
      setHandoff({})
    } catch { setMessage('网络中断，问题没有被假称为已保存。') } finally { setPending(false) }
  }

  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText([`问：${question}`, `第${result.matchedChapter}章`, result.originalText, result.interpretation, result.followUpQuestion].filter(Boolean).join('\n\n')); setCopied(true) } catch { setMessage('复制失败，请手动选择文字。') }
  }

  return <div className="relative min-h-screen"><main id="main-content" className="dao-reader">
    <Link href="/" className="dao-back">返回此刻</Link>
    <p className="dao-eyebrow">与道对话</p><h1>{result ? question : '从你的困惑，开始。'}</h1>
    {!ready ? <p role="status">正在恢复本标签页的问题…</p> : <form onSubmit={submit} className="dao-reading-card">
      <label htmlFor="ask-question">你的问题</label>
      {handoff.sourceEntryId && <p className="dao-status">此问题关联一条心笺；正文不会写入 URL，也不会被静默截断。</p>}
      <textarea id="ask-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={500} rows={6} disabled={pending} />
      <p>{question.length}/500</p><button className="dao-primary" disabled={pending} type="submit">{pending ? '正在问道…' : '问一问道'}</button>
    </form>}
    {message && <p className="dao-status" role="status">{message}</p>}
    {result && <article className="dao-reading-card"><p className="dao-eyebrow">第{result.matchedChapter}章</p><h2>回应</h2><p className="dao-interpretation">{result.interpretation}</p>{result.originalText && <><h3>原文</h3><blockquote>{result.originalText}</blockquote></>}{result.followUpQuestion && <p className="dao-reflection">{result.followUpQuestion}</p>}{result.meta.persistence !== 'saved' && <p className="dao-status">{result.meta.persistenceMessage ?? '本次回答未保存到云端历史。'}</p>}<div className="dao-reader-actions"><Link className="dao-primary" href={`/chapters/${result.matchedChapter}`}>读原文<ArrowUpRight size={16} /></Link><button type="button" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制' : '复制回答'}</button></div></article>}
  </main></div>
}

function readHandoff(value: string | null): Handoff {
  if (!value) return {}
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as Handoff : { question: value } } catch { return { question: value } }
}

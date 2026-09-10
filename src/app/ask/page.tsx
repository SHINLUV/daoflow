'use client'

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Copy, ArrowUpRight } from '@phosphor-icons/react'
import { getAuthSession } from '@/lib/auth/browser'
import type { AuthSessionInfo } from '@/lib/auth/contracts'
import type { AnswerV2 } from '@/lib/ai/answerV2'
import type { AskAnswerResponse } from '@/lib/ask-worker/answerResponse'
import {
  createAskAttempt, isOwnerEpochCurrent, nextOwnerEpoch, readAskAttempt, readEntryAskHandoff, sameAskPayload,
  type AskAttempt, type AskPayload, type OwnerEpoch,
} from '@/lib/journal/ask-requests'

type LegacyResult = {
  kind: 'legacy'
  question: string
  matchedChapter: number
  originalText: string | null
  interpretation: string
  followUpQuestion: string | null
}
type Result = AskAnswerResponse | LegacyResult
type RequestStatus = {
  requestId: string
  state: 'pending' | 'processing' | 'generated' | 'saved' | 'failed'
  result: AskAnswerResponse | null
  failureCode?: string | null
}
type Handoff = Pick<AskPayload, 'question' | 'sourceEntryId' | 'volumeId'>
type SavedAskSession = {
  id: string; question: string; matchedChapter: number; originalText: string | null; interpretation: string
  followUpQuestion: string | null; answerV2?: AnswerV2 | null; provider?: 'agnes' | 'none'
}

const DRAFT_KEY = 'daoflow:ask:draft'
const ENTRY_HANDOFF_KEY = 'daoflow:ask:entry-handoff'
const ATTEMPT_KEY = 'daoflow:ask:attempt'
const AUTH_SYNC_KEY = 'daoflow:auth:changed'
const MAX_STATUS_POLLS = 8

export default function AskPage() {
  return <Suspense fallback={<main id="main-content" className="dao-reader"><p role="status">正在载入问道…</p></main>}><AskPageContent /></Suspense>
}

function AskPageContent() {
  const searchParams = useSearchParams()
  const historySessionId = searchParams.get('sessionId')
  const [auth, setAuth] = useState<AuthSessionInfo | null>(null)
  const [ownerId, setOwnerId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [handoff, setHandoff] = useState<Handoff>({ question: '', sourceEntryId: null, volumeId: null })
  const [attempt, setAttempt] = useState<AskAttempt | null>(null)
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [retryingSave, setRetryingSave] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const ownerEpochRef = useRef<OwnerEpoch>({ ownerId: null, epoch: 0 })
  const controllersRef = useRef(new Set<AbortController>())
  const pollRevision = useRef(0)
  const restoredAttempt = useRef(false)
  const initialized = useRef(false)

  const beginOperation = useCallback(() => {
    const controller = new AbortController()
    controllersRef.current.add(controller)
    return { controller, ownerEpoch: ownerEpochRef.current }
  }, [])
  const endOperation = useCallback((controller: AbortController) => controllersRef.current.delete(controller), [])
  const isCurrentOperation = useCallback((epoch: OwnerEpoch) => isOwnerEpochCurrent(ownerEpochRef.current, epoch), [])
  const clearAttempt = useCallback(() => { sessionStorage.removeItem(ATTEMPT_KEY); setAttempt(null) }, [])
  const retainAttempt = useCallback((next: AskAttempt) => {
    const refreshed = { ...next, updatedAt: Date.now() }
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(refreshed)); setAttempt(refreshed)
    return refreshed
  }, [])
  const finishResult = useCallback((next: AskAnswerResponse, currentAttempt: AskAttempt | null) => {
    setResult(next); setMessage(''); setCopied(false)
    sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(ENTRY_HANDOFF_KEY); setHandoff({ question: '', sourceEntryId: null, volumeId: null })
    if (next.retrySaveAvailable && currentAttempt) retainAttempt({ ...currentAttempt, state: 'save_failed' })
    else clearAttempt()
  }, [clearAttempt, retainAttempt])

  const pollRequest = useCallback(async (currentAttempt: AskAttempt, maximum = MAX_STATUS_POLLS) => {
    const operation = beginOperation(); const revision = ++pollRevision.current
    setPending(true)
    const activeAttempt = retainAttempt({ ...currentAttempt, state: 'processing' })
    try {
      for (let count = 0; count < maximum; count += 1) {
        const response = await fetch(`/api/journal/ask-requests/${activeAttempt.requestId}`, { cache: 'no-store', credentials: 'same-origin', signal: operation.controller.signal })
        const data = await response.json().catch(() => ({})) as Partial<RequestStatus> & { error?: { message?: string } }
        if (revision !== pollRevision.current || !isCurrentOperation(operation.ownerEpoch)) return
        if (response.status === 202 || data.state === 'pending' || data.state === 'processing') {
          const seconds = Number(response.headers.get('retry-after') ?? 1)
          await wait(Number.isFinite(seconds) ? Math.min(5_000, Math.max(500, seconds * 1_000)) : 1_000, operation.controller.signal)
          continue
        }
        if (!response.ok) { setMessage(data.error?.message ?? '暂时无法读取问道状态；问题和 requestId 仍保留在本标签页。'); return }
        if ((data.state === 'saved' || data.state === 'generated') && data.result) { finishResult(data.result, activeAttempt); return }
        setMessage(data.failureCode ? `本次问道未生成可验证回答（${data.failureCode}），可稍后用同一问题重试。` : '这次问道没有可恢复的生成结果，问题仍保留，请确认后重试。')
        return
      }
      retainAttempt({ ...activeAttempt, state: 'processing' })
      setMessage('回答仍在生成中。可稍后继续查询；这不会重新调用模型。')
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setMessage('网络中断，已保留同一 requestId；可继续查询，不会重新调用模型。')
    } finally {
      endOperation(operation.controller)
      if (revision === pollRevision.current && isCurrentOperation(operation.ownerEpoch)) setPending(false)
    }
  }, [beginOperation, endOperation, finishResult, isCurrentOperation, retainAttempt])

  useEffect(() => {
    let active = true
    const controllers = controllersRef.current
    const applySession = (next: AuthSessionInfo) => {
      if (!active) return
      const nextOwner = next.user?.id ?? null
      const changed = ownerEpochRef.current.ownerId !== nextOwner
      if (changed) {
        controllers.forEach(controller => controller.abort()); controllers.clear()
        ownerEpochRef.current = nextOwnerEpoch(ownerEpochRef.current, nextOwner)
        pollRevision.current += 1; sessionStorage.removeItem(ENTRY_HANDOFF_KEY); sessionStorage.removeItem(ATTEMPT_KEY)
        setAttempt(null); setResult(null); setPending(false)
        if (initialized.current) setMessage(nextOwner ? '登录状态已更新；请确认后继续当前草稿。' : '登录状态已退出，为保护私密内容已停止查询。')
      }
      setAuth(next); setOwnerId(nextOwner)
      if (!initialized.current) {
        if (!historySessionId) {
          const rawEntry = sessionStorage.getItem(ENTRY_HANDOFF_KEY)
          const entry = readEntryAskHandoff(rawEntry, nextOwner)
          if (rawEntry && !entry) sessionStorage.removeItem(ENTRY_HANDOFF_KEY)
          if (entry) { setQuestion(entry.question); setHandoff(entry) }
          else {
            const stored = nextOwner ? readAskAttempt(sessionStorage.getItem(ATTEMPT_KEY), nextOwner) : null
            if (stored) { setQuestion(stored.question); setHandoff(stored); setAttempt(stored) }
            else { const draft = readOrdinaryDraft(sessionStorage.getItem(DRAFT_KEY)); setQuestion(draft.question); setHandoff(draft) }
          }
        }
        initialized.current = true; setReady(true)
      }
    }
    const refreshSession = () => {
      void getAuthSession().then(applySession).catch(() => {
        if (!active) return
        if (!initialized.current) {
          if (!historySessionId) {
            const draft = readOrdinaryDraft(sessionStorage.getItem(DRAFT_KEY))
            setQuestion(draft.question); setHandoff(draft)
          }
          initialized.current = true
        }
        setReady(true); setMessage('账户服务暂时不可用，无法安全提交或保存问道。')
      })
    }
    refreshSession()
    const onStorage = (event: StorageEvent) => { if (event.key === AUTH_SYNC_KEY) refreshSession() }
    window.addEventListener('storage', onStorage); window.addEventListener('focus', refreshSession)
    return () => { active = false; pollRevision.current += 1; controllers.forEach(controller => controller.abort()); controllers.clear(); window.removeEventListener('storage', onStorage); window.removeEventListener('focus', refreshSession) }
  }, [historySessionId])

  useEffect(() => {
    if (!ready || !historySessionId) return
    const operation = beginOperation(); setPending(true); setMessage('正在读取已保存的问道…')
    void fetch(`/api/ask/${encodeURIComponent(historySessionId)}`, { cache: 'no-store', credentials: 'same-origin', signal: operation.controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as { session?: SavedAskSession; error?: { message?: string } }
        if (!isCurrentOperation(operation.ownerEpoch)) return
        if (!response.ok || !data.session) { setResult(null); setMessage(data.error?.message ?? '未找到这条问道记录，或你没有权限查看。'); return }
        setQuestion(data.session.question); setHandoff({ question: data.session.question, sourceEntryId: null, volumeId: null }); setResult(savedSessionToResult(data.session)); setMessage('')
      })
      .catch(() => { if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setMessage('网络中断，暂时无法读取这条问道记录。') })
      .finally(() => { endOperation(operation.controller); if (isCurrentOperation(operation.ownerEpoch)) setPending(false) })
  }, [beginOperation, endOperation, historySessionId, isCurrentOperation, ready])

  useEffect(() => {
    if (!ready || !attempt || restoredAttempt.current) return
    restoredAttempt.current = true; void pollRequest(attempt)
  }, [attempt, pollRequest, ready])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || trimmed.length > 500) { setMessage('请写下 1–500 字的问题。'); return }
    if (!auth) { setMessage('账户安全会话尚未就绪，请刷新页面后重试。'); return }
    const payload: AskPayload = { question: trimmed, sourceEntryId: handoff.sourceEntryId ?? null, volumeId: handoff.volumeId ?? null }
    const requestId = attempt && sameAskPayload(attempt, payload) ? attempt.requestId : crypto.randomUUID()
    restoredAttempt.current = true
    const currentAttempt = ownerId ? retainAttempt(createAskAttempt(ownerId, requestId, payload)) : null
    const operation = beginOperation(); setPending(true); setMessage(''); setResult(null)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-daoflow-csrf': auth.csrfToken },
        body: JSON.stringify({ ...payload, requestId }), signal: operation.controller.signal,
      })
      const data = await response.json().catch(() => ({})) as AskAnswerResponse & Partial<RequestStatus> & { error?: { message?: string } }
      if (!isCurrentOperation(operation.ownerEpoch)) return
      if (response.status === 202) { if (currentAttempt) await pollRequest(currentAttempt); else setMessage('账户已变化；已停止读取私密问道状态。'); return }
      if (!response.ok) { setMessage(data.error?.message ?? '暂时无法回应；问题仍保留。'); return }
      finishResult(data, currentAttempt)
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setMessage('网络中断，问题和同一 requestId 已保留，没有假称已保存。')
    } finally { endOperation(operation.controller); if (isCurrentOperation(operation.ownerEpoch)) setPending(false) }
  }

  async function retrySave() {
    if (!attempt || !isV2(result) || !result.retrySaveAvailable || !auth) return
    const operation = beginOperation(); setRetryingSave(true); setMessage('')
    try {
      const response = await fetch(`/api/journal/ask-requests/${attempt.requestId}/retry-save`, {
        method: 'POST', credentials: 'same-origin', headers: { 'x-daoflow-csrf': auth.csrfToken }, signal: operation.controller.signal,
      })
      const data = await response.json().catch(() => ({})) as AskAnswerResponse & { error?: { message?: string } }
      if (!isCurrentOperation(operation.ownerEpoch)) return
      if (!response.ok) { setMessage(data.error?.message ?? '回答仍未保存；可继续复制内容后稍后重试。'); return }
      finishResult(data, attempt)
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setMessage('网络中断，未重新调用模型；服务端生成结果仍可稍后重试保存。')
    } finally { endOperation(operation.controller); if (isCurrentOperation(operation.ownerEpoch)) setRetryingSave(false) }
  }

  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(resultText(question, result)); setCopied(true) } catch { setMessage('复制失败，请手动选择文字。') }
  }

  return <div className="relative min-h-screen"><main id="main-content" className="dao-reader">
    <Link href="/" className="dao-back">返回此刻</Link>
    <p className="dao-eyebrow">与道对话</p><h1>{result ? question : '从你的困惑，开始。'}</h1>
    {!ready ? <p role="status">正在安全恢复本标签页的问题…</p> : !result && !historySessionId && <form onSubmit={submit} className="dao-reading-card dao-question-form">
      <label htmlFor="ask-question">你的问题</label>
      {handoff.sourceEntryId && <p className="dao-status">此问题关联一条心笺；正文不会写入 URL，也不会被静默截断。</p>}
      <textarea id="ask-question" value={question} onChange={event => setQuestion(event.target.value)} aria-describedby="ask-question-count" maxLength={500} rows={6} disabled={pending} placeholder="写下此刻最想问的一件事…" />
      <div className="dao-question-form-bottom"><p id="ask-question-count" aria-live="polite">{question.length}/500</p><button className="dao-primary" disabled={pending || !question.trim()} type="submit">{pending ? '正在问道…' : '问一问道'}</button></div>
    </form>}
    {attempt?.state === 'processing' && !pending && !result && <button type="button" className="dao-primary" onClick={() => void pollRequest(attempt)}>继续查询回答状态</button>}
    {message && <p className="dao-status" role="status">{message}</p>}
    {result && <article className="dao-reading-card"><AnswerContent result={result} />
      {isV2(result) && result.persistence !== 'saved' && <p className="dao-status">{result.persistence === 'generated' ? '回答已生成，但尚未写入历史。' : '匿名问道不会写入你的私人历史。'}</p>}
      <div className="dao-reader-actions">
        {isV2(result) && result.retrySaveAvailable && attempt && <button type="button" disabled={retryingSave} onClick={() => void retrySave()}>{retryingSave ? '正在重试保存…' : '仅重试保存'}</button>}
        {firstChapter(result) && <Link className="dao-primary" href={`/chapters/${firstChapter(result)}`} >读原文<ArrowUpRight size={16} /></Link>}
        <button type="button" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制' : '复制回答'}</button>
      </div>
    </article>}
  </main></div>
}

function AnswerContent({ result }: { result: Result }) {
  if (!isV2(result)) return <><p className="dao-eyebrow">第{result.matchedChapter}章</p><h2>回应</h2><p className="dao-interpretation">{result.interpretation}</p>{result.originalText && <><h3>原文</h3><blockquote>{result.originalText}</blockquote></>}{result.followUpQuestion && <p className="dao-reflection">{result.followUpQuestion}</p>}</>
  const answer = result.answerV2
  return <>
    <p className="dao-eyebrow">{answer.status === 'insufficient_evidence' ? '经典参考（非 AI）' : result.provider === 'agnes' ? 'Agnes AI 生成' : '可信依据不足'}</p>
    <h2>看见困惑</h2><p className="dao-interpretation">{answer.summary}</p>
    {answer.citations.length > 0 && <section><h3>读懂原文</h3>{answer.citations.map(citation => <blockquote key={citation.chunk_id}><p>《道德经》第 {citation.chapter} 章：{citation.quote}</p><footer>{citation.explanation}</footer></blockquote>)}</section>}
    {answer.interpretation && <section><h3>照见此刻</h3><p>{answer.interpretation}</p></section>}
    {answer.application && <section><h3>可以怎样试试</h3><p>{answer.application}</p></section>}
    {answer.boundary && <section><h3>也看另一面</h3><p>{answer.boundary}</p></section>}
    {answer.actions.length > 0 && <section><h3>可以试试</h3><ol>{answer.actions.map((action, index) => <li key={index}>{action}</li>)}</ol></section>}
    {answer.reflection && <p className="dao-reflection">{answer.reflection}</p>}
  </>
}

function isV2(value: Result | null): value is AskAnswerResponse { return Boolean(value && 'answerV2' in value) }
function firstChapter(value: Result): number | null { return isV2(value) ? value.answerV2.citations[0]?.chapter ?? null : value.matchedChapter }
function resultText(question: string, value: Result): string {
  if (!isV2(value)) return [`问：${question}`, `第${value.matchedChapter}章`, value.originalText, value.interpretation, value.followUpQuestion].filter(Boolean).join('\n\n')
  const answer = value.answerV2
  return [`问：${question}`, answer.summary, ...answer.citations.map(item => `《道德经》第${item.chapter}章：${item.quote}\n${item.explanation}`), answer.interpretation, answer.application, answer.boundary, ...answer.actions, answer.reflection].filter(Boolean).join('\n\n')
}
function savedSessionToResult(session: SavedAskSession): Result {
  if (session.answerV2 && (session.provider === 'agnes' || session.provider === 'none')) return { requestId: null, answerV2: session.answerV2, provider: session.provider, persistence: 'saved', sessionId: session.id, retrySaveAvailable: false }
  return { kind: 'legacy', question: session.question, matchedChapter: session.matchedChapter, originalText: session.originalText, interpretation: session.interpretation, followUpQuestion: session.followUpQuestion }
}
function readOrdinaryDraft(value: string | null): Handoff {
  if (!value) return { question: '', sourceEntryId: null, volumeId: null }
  try { const parsed: unknown = JSON.parse(value); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as { question?: unknown }).question === 'string') return { question: (parsed as { question: string }).question.slice(0, 500), sourceEntryId: null, volumeId: null } } catch { /* Legacy homepage drafts are plain text. */ }
  return { question: value.slice(0, 500), sourceEntryId: null, volumeId: null }
}
function wait(milliseconds: number, signal: AbortSignal) { return new Promise<void>((resolve, reject) => { const timer = window.setTimeout(resolve, milliseconds); signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true }) }) }

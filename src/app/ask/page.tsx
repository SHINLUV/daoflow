'use client'

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Check, Copy, ArrowUpRight } from '@phosphor-icons/react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import {
  createAskAttempt,
  fallbackNotice,
  isOwnerEpochCurrent,
  nextOwnerEpoch,
  readAskAttempt,
  readEntryAskHandoff,
  sameAskPayload,
  type AskAttempt,
  type AskPayload,
  type OwnerEpoch,
} from '@/lib/journal/ask-requests'

type Result = {
  requestId: string | null
  matchedChapter: number
  originalText: string | null
  interpretation: string
  followUpQuestion: string | null
  sessionId: string | null
  meta: {
    provider: string
    degraded: boolean
    fallbackReason: string | null
    persistence: 'saved' | 'failed' | 'not_requested'
    persistenceMessage?: string
    retrySaveAvailable: boolean
  }
}

type StatusResult = Omit<Result, 'requestId' | 'sessionId' | 'meta'> & {
  provider: string
  degraded: boolean
  fallbackReason: string | null
}

type RequestStatus = {
  requestId: string
  state: 'processing' | 'generated' | 'saved' | 'failed'
  result: StatusResult | null
  sessionId: string | null
}

type Handoff = Pick<AskPayload, 'question' | 'sourceEntryId' | 'volumeId'>

const DRAFT_KEY = 'daoflow:ask:draft'
const ENTRY_HANDOFF_KEY = 'daoflow:ask:entry-handoff'
const ATTEMPT_KEY = 'daoflow:ask:attempt'
const MAX_STATUS_POLLS = 8

export default function AskPage() {
  return <Suspense fallback={<main id="main-content" className="dao-reader"><p role="status">正在载入问道…</p></main>}><AskPageContent /></Suspense>
}

function AskPageContent() {
  const searchParams = useSearchParams()
  const historySessionId = searchParams.get('sessionId')
  const [supabase] = useState(() => createClient())
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

  const beginOperation = useCallback(() => {
    const controller = new AbortController()
    controllersRef.current.add(controller)
    return { controller, ownerEpoch: ownerEpochRef.current }
  }, [])

  const endOperation = useCallback((controller: AbortController) => {
    controllersRef.current.delete(controller)
  }, [])

  const isCurrentOperation = useCallback((ownerEpoch: OwnerEpoch) => {
    return isOwnerEpochCurrent(ownerEpochRef.current, ownerEpoch)
  }, [])

  const clearAttempt = useCallback(() => {
    sessionStorage.removeItem(ATTEMPT_KEY)
    setAttempt(null)
  }, [])

  const retainAttempt = useCallback((next: AskAttempt) => {
    const refreshed = { ...next, updatedAt: Date.now() }
    sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify(refreshed))
    setAttempt(refreshed)
    return refreshed
  }, [])

  const finishResult = useCallback((next: Result, currentAttempt: AskAttempt | null) => {
    setResult(next)
    setMessage('')
    sessionStorage.removeItem(DRAFT_KEY)
    sessionStorage.removeItem(ENTRY_HANDOFF_KEY)
    setHandoff({ question: '', sourceEntryId: null, volumeId: null })
    if (next.meta.persistence === 'failed' && next.meta.retrySaveAvailable && currentAttempt) {
      retainAttempt({ ...currentAttempt, state: 'save_failed' })
    } else {
      clearAttempt()
    }
  }, [clearAttempt, retainAttempt])

  const pollRequest = useCallback(async (currentAttempt: AskAttempt, maximum = MAX_STATUS_POLLS) => {
    const operation = beginOperation()
    const revision = ++pollRevision.current
    setPending(true)
    const activeAttempt = retainAttempt({ ...currentAttempt, state: 'processing' })
    try {
      for (let count = 0; count < maximum; count += 1) {
        const response = await fetch(`/api/journal/ask-requests/${activeAttempt.requestId}`, { cache: 'no-store', signal: operation.controller.signal })
        const data = await response.json().catch(() => ({})) as Partial<RequestStatus> & { error?: { message?: string } }
        if (revision !== pollRevision.current || !isCurrentOperation(operation.ownerEpoch)) return
        if (response.status === 202 || data.state === 'processing') {
          const seconds = Number(response.headers.get('retry-after') ?? 1)
          await wait(Number.isFinite(seconds) ? Math.min(5_000, Math.max(500, seconds * 1_000)) : 1_000, operation.controller.signal)
          continue
        }
        if (!response.ok) {
          setMessage(data.error?.message ?? '暂时无法读取问道状态；问题和 requestId 仍保留在本标签页。')
          return
        }
        if ((data.state === 'saved' || data.state === 'generated') && data.result && data.requestId) {
          const persistence = data.state === 'saved' ? 'saved' : 'failed'
          finishResult(statusToResult(data.result, data.requestId, data.sessionId ?? null, persistence), activeAttempt)
          return
        }
        setMessage('这次问道没有可恢复的生成结果，问题仍保留，请确认后重试。')
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
    let initialized = false
    let observedOwner: string | null | undefined
    let unsubscribe = () => {}
    const controllers = controllersRef.current
    const changeOwner = (nextOwner: string | null) => {
      observedOwner = nextOwner
      if (!active || ownerEpochRef.current.ownerId === nextOwner) return
      controllers.forEach(controller => controller.abort())
      controllers.clear()
      ownerEpochRef.current = nextOwnerEpoch(ownerEpochRef.current, nextOwner)
      setOwnerId(nextOwner)
      if (!initialized) return
      pollRevision.current += 1
      sessionStorage.removeItem(ENTRY_HANDOFF_KEY)
      sessionStorage.removeItem(ATTEMPT_KEY)
      sessionStorage.removeItem(DRAFT_KEY)
      setQuestion('')
      setHandoff({ question: '', sourceEntryId: null, volumeId: null })
      setAttempt(null)
      setResult(null)
      setPending(false)
      setMessage('登录账户已变化，为保护私密内容，请重新选择要问的问题。')
    }

    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        changeOwner(session?.user?.id ?? null)
      })
      unsubscribe = () => subscription.unsubscribe()
    }

    async function initialize() {
      let currentOwner: string | null = null
      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.auth.getUser()
          if (!error) currentOwner = data.user?.id ?? null
        } catch { /* Treat an unverified session as anonymous. */ }
      }
      if (!active) return
      if (observedOwner !== undefined) currentOwner = observedOwner
      ownerEpochRef.current = nextOwnerEpoch(ownerEpochRef.current, currentOwner)
      setOwnerId(currentOwner)

      // A saved-history URL is an ID-only view. Do not mix an old tab draft or
      // entry handoff into the record that will be fetched for this owner.
      if (!historySessionId) {
        const rawEntry = sessionStorage.getItem(ENTRY_HANDOFF_KEY)
        const entry = readEntryAskHandoff(rawEntry, currentOwner)
        if (rawEntry && !entry) {
          sessionStorage.removeItem(ENTRY_HANDOFF_KEY)
          setMessage('心笺来源账户无法确认，已清除交接内容；请回到心笺重新发起。')
        }

        if (entry) {
          sessionStorage.removeItem(ATTEMPT_KEY)
          setQuestion(entry.question)
          setHandoff(entry)
        } else {
          const storedAttempt = currentOwner ? readAskAttempt(sessionStorage.getItem(ATTEMPT_KEY), currentOwner) : null
          if (sessionStorage.getItem(ATTEMPT_KEY) && !storedAttempt) sessionStorage.removeItem(ATTEMPT_KEY)
          if (storedAttempt) {
            setQuestion(storedAttempt.question)
            setHandoff(storedAttempt)
            setAttempt(storedAttempt)
          } else {
            const ordinary = readOrdinaryDraft(sessionStorage.getItem(DRAFT_KEY))
            setQuestion(ordinary.question)
            setHandoff(ordinary)
          }
        }
      }
      setReady(true)
      initialized = true
    }
    void initialize()
    return () => { active = false; pollRevision.current += 1; controllers.forEach(controller => controller.abort()); controllers.clear(); unsubscribe() }
  }, [historySessionId, supabase])

  useEffect(() => {
    if (!ready || !historySessionId) return
    const operation = beginOperation()
    setPending(true)
    setMessage('正在读取已保存的问道…')
    void fetch(`/api/ask/${encodeURIComponent(historySessionId)}`, { cache: 'no-store', signal: operation.controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => ({})) as { session?: SavedAskSession; error?: { message?: string } }
        if (!isCurrentOperation(operation.ownerEpoch)) return
        if (!response.ok || !data.session) {
          setResult(null)
          setMessage(data.error?.message ?? '未找到这条问道记录，或你没有权限查看。')
          return
        }
        setQuestion(data.session.question)
        setHandoff({ question: data.session.question, sourceEntryId: null, volumeId: null })
        setResult(savedSessionToResult(data.session))
        setMessage('')
      })
      .catch(() => {
        if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setMessage('网络中断，暂时无法读取这条问道记录。')
      })
      .finally(() => {
        endOperation(operation.controller)
        if (isCurrentOperation(operation.ownerEpoch)) setPending(false)
      })
  }, [beginOperation, endOperation, historySessionId, isCurrentOperation, ownerId, ready])

  useEffect(() => {
    if (!ready || !attempt || restoredAttempt.current) return
    restoredAttempt.current = true
    void pollRequest(attempt)
  }, [attempt, pollRequest, ready])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = question.trim()
    if (!trimmed || trimmed.length > 500) { setMessage('请写下 1–500 字的问题。'); return }
    const payload: AskPayload = { question: trimmed, sourceEntryId: handoff.sourceEntryId ?? null, volumeId: handoff.volumeId ?? null }
    const requestId = attempt && sameAskPayload(attempt, payload) ? attempt.requestId : crypto.randomUUID()
    // The recovery effect is only for attempts loaded during initialization.
    // A freshly submitted attempt is driven by this request and its 202 branch.
    restoredAttempt.current = true
    const currentAttempt = ownerId ? retainAttempt(createAskAttempt(ownerId, requestId, payload)) : null
    const operation = beginOperation()
    setPending(true); setMessage(''); setResult(null)
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId }), signal: operation.controller.signal,
      })
      const data = await response.json().catch(() => ({})) as Result & { error?: { message?: string } }
      if (!isCurrentOperation(operation.ownerEpoch)) return
      if (response.status === 202) {
        if (currentAttempt) await pollRequest(currentAttempt)
        else setMessage('回答正在生成，但匿名状态无法跨刷新恢复；请稍候。')
        return
      }
      if (!response.ok) {
        setMessage(data.error?.message ?? '暂时无法回应；问题和同一 requestId 仍保留。')
        return
      }
      finishResult(data, currentAttempt)
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setMessage('网络中断，问题和同一 requestId 已保留，没有假称已保存。')
    } finally { endOperation(operation.controller); if (isCurrentOperation(operation.ownerEpoch)) setPending(false) }
  }

  async function retrySave() {
    if (!attempt || !result?.meta.retrySaveAvailable) return
    const operation = beginOperation()
    setRetryingSave(true); setMessage('')
    try {
      const response = await fetch(`/api/journal/ask-requests/${attempt.requestId}/retry-save`, { method: 'POST', signal: operation.controller.signal })
      const data = await response.json().catch(() => ({})) as Result & { error?: { message?: string } }
      if (!isCurrentOperation(operation.ownerEpoch)) return
      if (!response.ok) { setMessage(data.error?.message ?? '回答仍未保存；可继续复制内容后稍后重试。'); return }
      finishResult(data, attempt)
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setMessage('网络中断，未重新调用模型；服务端生成结果仍可稍后重试保存。')
    } finally { endOperation(operation.controller); if (isCurrentOperation(operation.ownerEpoch)) setRetryingSave(false) }
  }

  async function copy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText([`问：${question}`, `第${result.matchedChapter}章`, result.originalText, result.interpretation, result.followUpQuestion].filter(Boolean).join('\n\n'))
      setCopied(true)
    } catch { setMessage('复制失败，请手动选择文字。') }
  }

  const degradation = result ? fallbackNotice(result.meta.provider, result.meta.degraded, result.meta.fallbackReason) : null

  return <div className="relative min-h-screen"><main id="main-content" className="dao-reader">
    <Link href="/" className="dao-back">返回此刻</Link>
    <p className="dao-eyebrow">与道对话</p><h1>{result ? question : '从你的困惑，开始。'}</h1>
    {!ready ? <p role="status">正在安全恢复本标签页的问题…</p> : !result && !historySessionId && <form onSubmit={submit} className="dao-reading-card">
      <label htmlFor="ask-question">你的问题</label>
      {handoff.sourceEntryId && <p className="dao-status">此问题关联一条心笺；正文不会写入 URL，也不会被静默截断。</p>}
      <textarea id="ask-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={500} rows={6} disabled={pending} />
      <p>{question.length}/500</p><button className="dao-primary" disabled={pending} type="submit">{pending ? '正在问道…' : '问一问道'}</button>
    </form>}
    {attempt?.state === 'processing' && !pending && !result && <button type="button" className="dao-primary" onClick={() => void pollRequest(attempt)}>继续查询回答状态</button>}
    {message && <p className="dao-status" role="status">{message}</p>}
    {result && <article className="dao-reading-card">
      <p className="dao-eyebrow">第{result.matchedChapter}章</p><h2>回应</h2>
      {degradation && <p className="dao-status" role="status">{degradation}</p>}
      <p className="dao-interpretation">{result.interpretation}</p>
      {result.originalText && <><h3>原文</h3><blockquote>{result.originalText}</blockquote></>}
      {result.followUpQuestion && <p className="dao-reflection">{result.followUpQuestion}</p>}
      {result.meta.persistence !== 'saved' && <p className="dao-status">{result.meta.persistenceMessage ?? '本次回答未保存到云端历史。'}</p>}
      <div className="dao-reader-actions">
        {result.meta.retrySaveAvailable && attempt && <button type="button" disabled={retryingSave} onClick={() => void retrySave()}>{retryingSave ? '正在重试保存…' : '仅重试保存'}</button>}
        <Link className="dao-primary" href={`/chapters/${result.matchedChapter}`}>读原文<ArrowUpRight size={16} /></Link>
        <button type="button" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '已复制' : '复制回答'}</button>
      </div>
    </article>}
  </main></div>
}

type SavedAskSession = {
  id: string
  question: string
  matchedChapter: number
  originalText: string | null
  interpretation: string
  followUpQuestion: string | null
  provider: string
  degraded: boolean
  fallbackReason: string | null
}

function savedSessionToResult(session: SavedAskSession): Result {
  return {
    requestId: null,
    matchedChapter: session.matchedChapter,
    originalText: session.originalText,
    interpretation: session.interpretation,
    followUpQuestion: session.followUpQuestion,
    sessionId: session.id,
    meta: {
      provider: session.provider,
      degraded: session.degraded,
      fallbackReason: session.fallbackReason,
      persistence: 'saved',
      retrySaveAvailable: false,
    },
  }
}

function readOrdinaryDraft(value: string | null): Handoff {
  if (!value) return { question: '', sourceEntryId: null, volumeId: null }
  try {
    const parsed: unknown = JSON.parse(value)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && typeof (parsed as { question?: unknown }).question === 'string') {
      return { question: (parsed as { question: string }).question.slice(0, 500), sourceEntryId: null, volumeId: null }
    }
  } catch { /* Legacy homepage drafts are plain text. */ }
  return { question: value.slice(0, 500), sourceEntryId: null, volumeId: null }
}

function statusToResult(snapshot: StatusResult, requestId: string, sessionId: string | null, persistence: 'saved' | 'failed'): Result {
  return {
    requestId,
    matchedChapter: snapshot.matchedChapter,
    originalText: snapshot.originalText,
    interpretation: snapshot.interpretation,
    followUpQuestion: snapshot.followUpQuestion,
    sessionId: persistence === 'saved' ? sessionId : null,
    meta: {
      provider: snapshot.provider,
      degraded: snapshot.degraded,
      fallbackReason: snapshot.fallbackReason,
      persistence,
      retrySaveAvailable: persistence === 'failed',
      ...(persistence === 'failed' ? { persistenceMessage: '回答已在服务端生成，但尚未写入历史；可仅重试保存。' } : {}),
    },
  }
}

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => { window.clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')) }, { once: true })
  })
}

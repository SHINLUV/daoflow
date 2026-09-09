'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { PaperPanel } from '@/components/v2/shared/PaperPanel'
import { PrimaryButton } from '@/components/v2/shared/PrimaryButton'
import { StatusMessage } from '@/components/v2/shared/StatusMessage'
import { useDaoNavigation } from '@/components/v2/motion/MotionProvider'
import type { Entry, Mood, Volume } from '@/lib/journal/contracts'
import { InputRevision, PrivateDataEpoch } from '@/lib/journal/entries'
import { isJournalUuid } from '@/lib/journal/volumes'
import styles from './journal.module.css'

const moods: Array<{ value: Mood; label: string }> = [
  { value: 'calm', label: '平静' }, { value: 'uneasy', label: '不安' }, { value: 'sad', label: '低落' },
  { value: 'angry', label: '愤懑' }, { value: 'hopeful', label: '有望' }, { value: 'mixed', label: '复杂' },
]

type Draft = { title: string; body: string; mood: Mood | ''; volumeId: string }
type ApiFailure = { error?: { code?: string; message?: string }; requestId?: string; currentVersion?: number | null }

function emptyDraft(): Draft { return { title: '', body: '', mood: '', volumeId: '' } }
function entryDraft(entry: Entry): Draft {
  return { title: entry.title ?? '', body: entry.body, mood: entry.mood ?? '', volumeId: entry.volumeId ?? '' }
}
function freshId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
function parseFailure(value: unknown): ApiFailure { return value && typeof value === 'object' ? value as ApiFailure : {} }
function messageFor(error: ApiFailure) {
  if (error.error?.code === 'AUTH_REQUIRED') return '登录状态已失效。内容仍保留在此页，请重新登录后保存。'
  if (error.error?.code === 'SUPABASE_UNAVAILABLE') return '私人记录服务尚未配置。内容仍保留在此页。'
  if (error.error?.code === 'VERSION_CONFLICT') return `远端已有版本 ${error.currentVersion ?? '更新'}。本地草稿未被覆盖，请选择加载远端内容或另存。`
  return error.error?.message || '保存未完成。内容仍保留在此页，请检查网络后重试。'
}

export function JournalEditor({ entryId }: { entryId?: string }) {
  const router = useRouter()
  const { navigate } = useDaoNavigation()
  const searchParams = useSearchParams()
  const requestedVolumeId = searchParams.get('volumeId')
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [authKnown, setAuthKnown] = useState(false)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [entryLoadState, setEntryLoadState] = useState<'idle' | 'loading' | 'loaded' | 'failed'>(entryId ? 'loading' : 'loaded')
  const [draft, setDraft] = useState<Draft>(() => ({ ...emptyDraft(), volumeId: isJournalUuid(requestedVolumeId) ? requestedVolumeId : '' }))
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(entryId))
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [sendingLogin, setSendingLogin] = useState(false)
  const [openedLoginInAnotherTab, setOpenedLoginInAnotherTab] = useState(false)
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [volumeError, setVolumeError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [failedAction, setFailedAction] = useState<{ kind: 'load' } | { kind: 'recycle'; deleted: boolean } | { kind: 'purge' } | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const [askQuestion, setAskQuestion] = useState('')
  const askDialog = useRef<HTMLDialogElement>(null)
  const createId = useRef(freshId())
  const draftId = useRef(searchParams.get('draftId') || freshId()).current
  const privateEpoch = useRef(new PrivateDataEpoch())
  const draftRevision = useRef(new InputRevision())
  const draftRef = useRef(draft)
  const dirtyRef = useRef(false)
  const requests = useRef(new Set<AbortController>())

  const signedDraftKey = useMemo(() => userId ? `daoflow:journal:draft:${userId}:${entryId ?? 'new'}` : null, [entryId, userId])
  const loginDraftKey = `daoflow:journal:login:${draftId}`
  const readOnly = Boolean(entry?.deletedAt)

  const clearPrivateUi = useCallback(() => {
    requests.current.forEach(controller => controller.abort()); requests.current.clear()
    createId.current = freshId()
    draftRevision.current.bump(); dirtyRef.current = false
    draftRef.current = { ...emptyDraft(), volumeId: isJournalUuid(requestedVolumeId) ? requestedVolumeId : '' }
    setEntry(null); setVolumes([]); setDraft({ ...emptyDraft(), volumeId: isJournalUuid(requestedVolumeId) ? requestedVolumeId : '' }); setIsDirty(false); setConflict(false); setFailedAction(null); setNotice(''); setError(''); setVolumeError('')
    setEntryLoadState(entryId ? 'idle' : 'loaded')
    setAskOpen(false); setAskQuestion(''); setSaving(false); setLoading(false)
  }, [entryId, requestedVolumeId])

  const acceptUser = useCallback((nextUserId: string | null, signedOut = false) => {
    const previousUserId = privateEpoch.current.capture().ownerId
    if (previousUserId && previousUserId !== nextUserId) sessionStorage.removeItem(`daoflow:journal:draft:${previousUserId}:${entryId ?? 'new'}`)
    if (signedOut) sessionStorage.removeItem(loginDraftKey)
    if (privateEpoch.current.acceptOwner(nextUserId)) clearPrivateUi()
    setUserId(nextUserId); setAuthKnown(true)
  }, [clearPrivateUi, entryId, loginDraftKey])

  function beginPrivateRequest() {
    const controller = new AbortController(); requests.current.add(controller)
    return { controller, token: privateEpoch.current.capture() }
  }

  const hydrateEntry = useCallback(async (replaceLocalDraft = false) => {
    if (!entryId || !isSupabaseConfigured || !userId) { setLoading(false); return }
    const request = beginPrivateRequest()
    const revision = draftRevision.current.capture()
    setLoading(true)
    setEntryLoadState('loading')
    setFailedAction(null)
    setError('')
    try {
      const response = await fetch(`/api/journal/entries/${entryId}`, { cache: 'no-store', signal: request.controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw parseFailure(payload)
      if (!privateEpoch.current.isCurrent(request.token)) return
      const remote = payload.entry as Entry
      setEntry(remote)
      setEntryLoadState('loaded')
      if (replaceLocalDraft || (!dirtyRef.current && draftRevision.current.isCurrent(revision))) {
        const nextDraft = entryDraft(remote)
        draftRef.current = nextDraft; draftRevision.current.bump(); dirtyRef.current = false; setDraft(nextDraft); setIsDirty(false)
      }
      setError('')
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setEntryLoadState('failed'); setFailedAction({ kind: 'load' }); setError(messageFor(parseFailure(reason))) }
    } finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setLoading(false) }
  }, [entryId, userId])

  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthKnown(true); setError('私人记录服务尚未配置；你可以继续写下内容，但现在不能保存。'); return }
    const requestSet = requests.current
    let active = true
    let authRevision = 0
    const refresh = async () => {
      const revision = ++authRevision
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      if (active && revision === authRevision) acceptUser(data.user?.id ?? null)
    }
    void refresh()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authRevision += 1
      acceptUser(session?.user?.id ?? null, event === 'SIGNED_OUT')
    })
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('focus', onFocus); requestSet.forEach(controller => controller.abort()) }
  }, [acceptUser, supabase])

  useEffect(() => {
    if (!authKnown) return
    if (!userId) { setLoading(false); return }
    void hydrateEntry()
  }, [authKnown, hydrateEntry, userId])

  useEffect(() => {
    if (!userId) { setVolumes([]); return }
    const request = beginPrivateRequest()
    const requestSet = requests.current
    void (async () => {
      try {
        const collected: Volume[] = []
        let cursor: string | null = null
        do {
          const params = new URLSearchParams({ limit: '50' })
          if (cursor) params.set('cursor', cursor)
          const response = await fetch(`/api/journal/volumes?${params}`, { signal: request.controller.signal })
          const data = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(data.error?.message || '卷册列表读取失败。')
          collected.push(...(data.items ?? []))
          cursor = data.nextCursor ?? null
        } while (cursor)
        if (privateEpoch.current.isCurrent(request.token)) { setVolumes(Array.from(new Map(collected.map(volume => [volume.id, volume])).values())); setVolumeError('') }
      } catch (reason) {
        if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setVolumes([]); setVolumeError(reason instanceof Error ? reason.message : '暂时无法读取卷册。') }
      } finally {
        requests.current.delete(request.controller)
      }
    })()
    return () => { request.controller.abort(); requestSet.delete(request.controller) }
  }, [userId])

  useEffect(() => {
    if (!signedDraftKey || !isDirty) return
    sessionStorage.setItem(signedDraftKey, JSON.stringify({ draft, createId: createId.current }))
  }, [draft, isDirty, signedDraftKey])

  useEffect(() => {
    if (!signedDraftKey || !authKnown || (entryId && loading)) return
    const raw = sessionStorage.getItem(signedDraftKey)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      const savedDraft = parsed?.draft ?? parsed
      if (!entryId && isJournalUuid(parsed?.createId)) createId.current = parsed.createId
      const nextDraft = { ...emptyDraft(), ...savedDraft } as Draft
      draftRef.current = nextDraft; draftRevision.current.bump(); dirtyRef.current = true; setDraft(nextDraft); setIsDirty(true); setNotice('已恢复此账户在本浏览器的未保存草稿。')
    } catch { sessionStorage.removeItem(signedDraftKey) }
  }, [authKnown, entryId, loading, signedDraftKey])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (isDirty) { event.preventDefault(); event.returnValue = '' } }
    const beforeNavigation = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!isDirty || !anchor || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return
      if (!window.confirm('有未保存的修改。确定离开并放弃当前未保存内容吗？')) { event.preventDefault(); event.stopPropagation() }
    }
    const beforeHistoryNavigation = () => {
      if (isDirty && !window.confirm('有未保存的修改。确定离开并放弃当前未保存内容吗？')) window.history.forward()
    }
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('click', beforeNavigation, true)
    window.addEventListener('popstate', beforeHistoryNavigation)
    return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('click', beforeNavigation, true); window.removeEventListener('popstate', beforeHistoryNavigation) }
  }, [isDirty])

  useEffect(() => {
    if (!askOpen) return
    const previous = document.activeElement as HTMLElement | null
    askDialog.current?.showModal()
    return () => previous?.focus()
  }, [askOpen])

  useEffect(() => {
    if (!userId || !authKnown || (entryId && loading)) return
    const raw = sessionStorage.getItem(loginDraftKey)
    if (!raw) return
    try {
      const saved = JSON.parse(raw)
      if (saved.draft && (saved.entryId ?? undefined) === entryId) {
        if (!entryId && isJournalUuid(saved.createId)) createId.current = saved.createId
        const nextDraft = { ...emptyDraft(), ...saved.draft } as Draft
        draftRef.current = nextDraft; draftRevision.current.bump(); dirtyRef.current = true; setDraft(nextDraft); setIsDirty(true)
        setOpenedLoginInAnotherTab(false); setNotice('已恢复登录前的草稿，请确认后保存。')
        sessionStorage.removeItem(loginDraftKey)
      }
    } catch { /* Preserve an unreadable draft for manual recovery. */ }
  }, [authKnown, entryId, loading, loginDraftKey, userId])

  useEffect(() => {
    const returnedDraftId = searchParams.get('draftId')
    if (returnedDraftId && !sessionStorage.getItem(`daoflow:journal:login:${returnedDraftId}`)) {
      setOpenedLoginInAnotherTab(true)
    }
  }, [searchParams])

  const updateDraft = (part: Partial<Draft>) => {
    const nextDraft = { ...draftRef.current, ...part }
    draftRef.current = nextDraft; draftRevision.current.bump(); dirtyRef.current = true; setDraft(nextDraft); setIsDirty(true)
    if (!(entryId && entryLoadState === 'failed')) setError('')
    setNotice('')
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (entryId && entryLoadState !== 'loaded') { setError('这封心笺尚未成功载入，不能改为新建保存。请先重试加载。'); setFailedAction({ kind: 'load' }); return }
    if (!draft.body.trim()) { setError('请先写下一句心事。'); return }
    if (draft.body.trim().length > 10_000) { setError('正文不能超过 10000 个字符。'); return }
    if (!isSupabaseConfigured) { setError('私人记录服务尚未配置。内容仍保留在此页。'); return }
    if (!userId) { setError('请先登录后保存。点击“登录并保存草稿”可在此浏览器暂存草稿。'); return }
    const request = beginPrivateRequest()
    const revision = draftRevision.current.capture()
    setSaving(true); setError(''); setNotice('正在落笔保存…')
    try {
      const body = entry
        ? { version: entry.version, body: draft.body, title: draft.title || null, mood: draft.mood || null, volumeId: draft.volumeId || null }
        : { id: createId.current, body: draft.body, title: draft.title || undefined, mood: draft.mood || null, volumeId: draft.volumeId || null }
      if (entry && draft.volumeId === (entry.volumeId ?? '')) delete (body as { volumeId?: string | null }).volumeId
      const response = await fetch(entry ? `/api/journal/entries/${entry.id}` : '/api/journal/entries', {
        method: entry ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: request.controller.signal,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw parseFailure(payload)
      if (!privateEpoch.current.isCurrent(request.token)) return
      const saved = payload.entry as Entry
      setEntry(saved); setEntryLoadState('loaded')
      if (draftRevision.current.isCurrent(revision)) {
        const nextDraft = entryDraft(saved)
        draftRef.current = nextDraft; draftRevision.current.bump(); dirtyRef.current = false; setDraft(nextDraft); setIsDirty(false); if (signedDraftKey) sessionStorage.removeItem(signedDraftKey)
        setNotice('已保存。')
      } else {
        dirtyRef.current = true; setIsDirty(true)
        if (!entry && userId) {
          sessionStorage.setItem(`daoflow:journal:draft:${userId}:${saved.id}`, JSON.stringify({ draft: draftRef.current, createId: saved.id }))
          if (signedDraftKey) sessionStorage.removeItem(signedDraftKey)
        }
        setNotice('提交时的版本已保存；你继续输入的修改仍未保存。')
      }
      setConflict(false); setFailedAction(null)
      if (!entry) router.replace(`/journal/entries/${saved.id}`)
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setNotice(''); setConflict(parseFailure(reason).error?.code === 'VERSION_CONFLICT'); setError(messageFor(parseFailure(reason))) } }
    finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setSaving(false) }
  }

  async function setRecycled(deleted: boolean) {
    if (!entry) return
    if (isDirty && !window.confirm('当前有未保存的修改。继续会放弃这些修改，确定吗？')) return
    const request = beginPrivateRequest()
    setSaving(true); setError(''); setFailedAction(null); setNotice(deleted ? '正在移入回收站…' : '正在恢复…')
    try {
      const response = await fetch(`/api/journal/entries/${entry.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: entry.version, deleted }), signal: request.controller.signal })
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw parseFailure(payload)
      if (!privateEpoch.current.isCurrent(request.token)) return
      const updated = payload.entry as Entry
      const nextDraft = entryDraft(updated)
      setEntry(updated); draftRef.current = nextDraft; draftRevision.current.bump(); dirtyRef.current = false; setDraft(nextDraft); setIsDirty(false); if (signedDraftKey) sessionStorage.removeItem(signedDraftKey)
      setConflict(false); setFailedAction(null); setNotice(deleted ? '已移入回收站。' : '已从回收站恢复。')
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { const failure=parseFailure(reason); setNotice(''); setConflict(failure.error?.code === 'VERSION_CONFLICT'); setFailedAction({ kind: 'recycle', deleted }); setError(messageFor(failure)) } } finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setSaving(false) }
  }

  async function purge() {
    if (!entry || !window.confirm('确定永久删除这封心笺吗？此操作无法恢复，且只会删除这封已回收的记录。')) return
    const request = beginPrivateRequest()
    setSaving(true); setError(''); setFailedAction(null); setNotice('正在永久删除…')
    try {
      const response = await fetch(`/api/journal/entries/${entry.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: entry.version }), signal: request.controller.signal })
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw parseFailure(payload)
      if (!privateEpoch.current.isCurrent(request.token)) return
      if (signedDraftKey) sessionStorage.removeItem(signedDraftKey)
      dirtyRef.current = false; setIsDirty(false); router.replace('/journal')
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { const failure=parseFailure(reason); setNotice(''); setConflict(failure.error?.code === 'VERSION_CONFLICT'); setFailedAction({ kind: 'purge' }); setError(messageFor(failure)) } } finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setSaving(false) }
  }

  async function sendLoginLink(event: FormEvent) {
    event.preventDefault()
    if (!isSupabaseConfigured || !loginEmail.trim()) return
    sessionStorage.setItem(loginDraftKey, JSON.stringify({ entryId: entryId ?? null, draft, createId: createId.current }))
    setSendingLogin(true); setError('')
    try {
      const destination = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/journal${entryId ? `/entries/${entryId}` : '/new'}?draftId=${draftId}`)}`
      const { error: authError } = await supabase.auth.signInWithOtp({ email: loginEmail.trim(), options: { emailRedirectTo: destination } })
      if (authError) throw authError
      setNotice('登录链接已发送。请在原标签页完成登录后继续保存；若链接在新标签打开，请回到这里。')
    } catch { setError('登录链接未能发送。草稿仍保留在当前标签页。') } finally { setSendingLogin(false) }
  }

  if (openedLoginInAnotherTab) {
    // The magic link may open a new tab, whose sessionStorage deliberately cannot contain the private draft.
    return <main className={styles.page}><PaperPanel className={styles.paper}><h1>请回原标签继续保存</h1><p>为保护隐私，草稿只保留在发起登录的原标签页，并没有随链接传递。</p></PaperPanel></main>
  }

  return <main className={styles.page}>
    <PaperPanel className={styles.paper}>
      <header className={styles.heading}><p className={styles.kicker}>心笺</p><h1>{entry ? '写给此刻的自己' : '记下此刻'}</h1><p>不必写得完整，先把心里的话放在这里。</p></header>
      {loading && <StatusMessage kind="loading">正在取回这封心笺…</StatusMessage>}
      {notice && <StatusMessage kind="success">{notice}</StatusMessage>}
      {error && <StatusMessage kind="error">{error} {failedAction && <button type="button" onClick={() => failedAction.kind === 'load' ? void hydrateEntry() : failedAction.kind === 'purge' ? void purge() : void setRecycled(failedAction.deleted)}>重试刚才的操作</button>}</StatusMessage>}
      {volumeError && <StatusMessage kind="error">{volumeError} 你仍可暂不归卷并保存。</StatusMessage>}
      {conflict && <button type="button" onClick={() => { if (window.confirm('加载远端版本会替换输入框中的本地草稿，确定继续吗？')) { setConflict(false); void hydrateEntry(true) } }}>加载远端版本（替换本地草稿）</button>}
      {readOnly && <StatusMessage kind="empty">这封心笺已在回收站。恢复后才能编辑或用于问道。</StatusMessage>}
      <form onSubmit={save} className={styles.form}>
        <label>题目（可选）<input value={draft.title} maxLength={60} disabled={readOnly || loading} onChange={e => updateDraft({ title: e.target.value })} placeholder="给这一刻取个名字" /></label>
        <label>正文 <span className={styles.required}>必填</span><textarea value={draft.body} minLength={1} maxLength={10_000} required disabled={readOnly || loading} onChange={e => updateDraft({ body: e.target.value })} placeholder="此刻，什么让你挂心？" /></label>
        <p className={styles.counter}>{draft.body.trim().length}/10000</p>
        <details className={styles.more}><summary>更多选项</summary><div className={styles.moreFields}>
          <label>心情（可选）<select value={draft.mood} disabled={readOnly || loading} onChange={e => updateDraft({ mood: e.target.value as Mood | '' })}><option value="">不标记</option>{moods.map(mood => <option key={mood.value} value={mood.value}>{mood.label}</option>)}</select></label>
          <label>所属卷册（可选）<select value={draft.volumeId} disabled={readOnly || loading} onChange={e => updateDraft({ volumeId: e.target.value })}><option value="">暂不归卷</option>{volumes.filter(volume => !volume.archivedAt || volume.id === draft.volumeId).map(volume => <option key={volume.id} value={volume.id}>{volume.title}{volume.archivedAt ? '（已归档）' : ''}</option>)}</select></label>
        </div></details>
        {!readOnly && <PrimaryButton type="submit" disabled={saving || loading || Boolean(entryId && entryLoadState !== 'loaded')}>{saving ? '正在保存…' : entryId ? '保存修改' : '保存心笺'}</PrimaryButton>}
      </form>
      {!authKnown ? <StatusMessage kind="loading">正在确认登录状态…</StatusMessage> : !userId && isSupabaseConfigured && !readOnly && <form className={styles.login} onSubmit={sendLoginLink}><label>登录后保存 <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label><button type="submit" disabled={sendingLogin}>{sendingLogin ? '正在发送…' : '登录并保存草稿'}</button><p>点击即同意仅在此浏览器的原标签页暂存草稿，以完成登录。</p></form>}
      {entry && <div className={styles.danger}>{readOnly ? <><button type="button" onClick={() => void setRecycled(false)} disabled={saving}>恢复记录</button><button type="button" onClick={() => void purge()} disabled={saving}>永久删除</button></> : <button type="button" onClick={() => void setRecycled(true)} disabled={saving}>移入回收站</button>}</div>}
      {entry && !readOnly && <button type="button" className="dao-primary" disabled={saving || isDirty} onClick={() => { setAskQuestion(entry.body.length <= 500 ? entry.body : ''); setAskOpen(true) }}>带着这条记录问道</button>}
      {askOpen && <dialog ref={askDialog} onCancel={() => setAskOpen(false)} aria-labelledby="entry-ask-title" style={{ width: 'min(580px, calc(100% - 32px))', padding: 24, background: '#f8f4e9', border: '1px solid #b5a789' }}>
        <h2 id="entry-ask-title">把此刻的心事，整理成一个问题</h2>
        <p>{entry && entry.body.length > 500 ? '这条记录超过500字，请自行提炼问题。完整记录不会被截断或自动发送。' : '确认或改写下方问题后再进入问道；此步骤不会调用模型。'}</p>
        <label>准备问道的问题<textarea value={askQuestion} maxLength={500} rows={6} onChange={event => setAskQuestion(event.target.value)} style={{ width: '100%', margin: '12px 0' }} /></label>
        <p>{askQuestion.length}/500</p>
        <button type="button" onClick={() => setAskOpen(false)} style={{ minHeight: 44, marginRight: 16 }}>取消</button>
        <PrimaryButton disabled={!askQuestion.trim()} onClick={() => { if (!entry) return; sessionStorage.setItem('daoflow:ask:entry-handoff', JSON.stringify({ question: askQuestion.trim(), sourceEntryId: entry.id, volumeId: entry.volumeId, ownerId: userId })); setAskOpen(false); navigate('/ask') }}>确认并进入问道</PrimaryButton>
      </dialog>}
      {isDirty && <p className={styles.unsaved} role="status">有未保存的修改，离开页面前会提醒你。</p>}
    </PaperPanel>
  </main>
}

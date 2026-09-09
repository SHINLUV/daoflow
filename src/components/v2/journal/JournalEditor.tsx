'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { PaperPanel } from '@/components/v2/shared/PaperPanel'
import { PrimaryButton } from '@/components/v2/shared/PrimaryButton'
import { StatusMessage } from '@/components/v2/shared/StatusMessage'
import type { Entry, Mood } from '@/lib/journal/contracts'
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
function freshId() { return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-journal` }
function parseFailure(value: unknown): ApiFailure { return value && typeof value === 'object' ? value as ApiFailure : {} }
function messageFor(error: ApiFailure) {
  if (error.error?.code === 'AUTH_REQUIRED') return '登录状态已失效。内容仍保留在此页，请重新登录后保存。'
  if (error.error?.code === 'SUPABASE_UNAVAILABLE') return '私人记录服务尚未配置。内容仍保留在此页。'
  if (error.error?.code === 'VERSION_CONFLICT') return `远端已有版本 ${error.currentVersion ?? '更新'}。本地草稿未被覆盖，请选择加载远端内容或另存。`
  return error.error?.message || '保存未完成。内容仍保留在此页，请检查网络后重试。'
}

export function JournalEditor({ entryId }: { entryId?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [supabase] = useState(() => createClient())
  const [userId, setUserId] = useState<string | null>(null)
  const [authKnown, setAuthKnown] = useState(false)
  const [entry, setEntry] = useState<Entry | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(Boolean(entryId))
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [sendingLogin, setSendingLogin] = useState(false)
  const [openedLoginInAnotherTab, setOpenedLoginInAnotherTab] = useState(false)
  const draftId = useRef(freshId()).current

  const signedDraftKey = useMemo(() => userId ? `daoflow:journal:draft:${userId}:${entryId ?? 'new'}` : null, [entryId, userId])
  const loginDraftKey = `daoflow:journal:login:${draftId}`
  const readOnly = Boolean(entry?.deletedAt)

  const hydrateEntry = useCallback(async (preserveDraft = false) => {
    if (!entryId || !isSupabaseConfigured) { setLoading(false); return }
    setLoading(true)
    try {
      const response = await fetch(`/api/journal/entries/${entryId}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw parseFailure(payload)
      const remote = payload.entry as Entry
      setEntry(remote)
      if (!preserveDraft) { setDraft(entryDraft(remote)); setIsDirty(false) }
      setError('')
    } catch (reason) {
      setError(messageFor(parseFailure(reason)))
    } finally { setLoading(false) }
  }, [entryId])

  useEffect(() => {
    if (!isSupabaseConfigured) { setAuthKnown(true); setError('私人记录服务尚未配置；你可以继续写下内容，但现在不能保存。'); return }
    let active = true
    supabase.auth.getUser().then(({ data }) => { if (active) { setUserId(data.user?.id ?? null); setAuthKnown(true) } }).catch(() => { if (active) { setUserId(null); setAuthKnown(true) } })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'SIGNED_OUT' && userId) sessionStorage.removeItem(`daoflow:journal:draft:${userId}:${entryId ?? 'new'}`)
      setUserId(session?.user?.id ?? null)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [entryId, supabase, userId])

  useEffect(() => { void hydrateEntry() }, [hydrateEntry])

  useEffect(() => {
    if (!signedDraftKey || !isDirty) return
    sessionStorage.setItem(signedDraftKey, JSON.stringify(draft))
  }, [draft, isDirty, signedDraftKey])

  useEffect(() => {
    if (!signedDraftKey || entry || !authKnown) return
    const raw = sessionStorage.getItem(signedDraftKey)
    if (!raw) return
    try { setDraft({ ...emptyDraft(), ...JSON.parse(raw) } as Draft); setIsDirty(true); setNotice('已恢复此账户在本浏览器的未保存草稿。') } catch { sessionStorage.removeItem(signedDraftKey) }
  }, [authKnown, entry, signedDraftKey])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (isDirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [isDirty])

  useEffect(() => {
    const onFocus = () => { if (isSupabaseConfigured) void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null)) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [supabase])

  useEffect(() => {
    const returnedDraftId = searchParams.get('draftId')
    if (returnedDraftId && !sessionStorage.getItem(`daoflow:journal:login:${returnedDraftId}`)) {
      setOpenedLoginInAnotherTab(true)
    }
  }, [searchParams])

  const updateDraft = (part: Partial<Draft>) => { setDraft(current => ({ ...current, ...part })); setIsDirty(true); setError(''); setNotice('') }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!draft.body.trim()) { setError('请先写下一句心事。'); return }
    if (draft.body.trim().length > 10_000) { setError('正文不能超过 10000 个字符。'); return }
    if (!isSupabaseConfigured) { setError('私人记录服务尚未配置。内容仍保留在此页。'); return }
    if (!userId) { setError('请先登录后保存。点击“登录并保存草稿”可在此浏览器暂存草稿。'); return }
    setSaving(true); setError(''); setNotice('正在落笔保存…')
    try {
      const body = entry
        ? { version: entry.version, body: draft.body, title: draft.title || null, mood: draft.mood || null, volumeId: draft.volumeId || null }
        : { id: freshId(), body: draft.body, title: draft.title || undefined, mood: draft.mood || null, volumeId: draft.volumeId || null }
      const response = await fetch(entry ? `/api/journal/entries/${entry.id}` : '/api/journal/entries', {
        method: entry ? 'PATCH' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw parseFailure(payload)
      const saved = payload.entry as Entry
      setEntry(saved); setDraft(entryDraft(saved)); setIsDirty(false); if (signedDraftKey) sessionStorage.removeItem(signedDraftKey)
      setNotice('已保存。')
      if (!entry) router.replace(`/journal/entries/${saved.id}`)
    } catch (reason) { setNotice(''); setError(messageFor(parseFailure(reason))) }
    finally { setSaving(false) }
  }

  async function setRecycled(deleted: boolean) {
    if (!entry) return
    setSaving(true); setError(''); setNotice(deleted ? '正在移入回收站…' : '正在恢复…')
    try {
      const response = await fetch(`/api/journal/entries/${entry.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: entry.version, deleted }) })
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw parseFailure(payload)
      setEntry(payload.entry as Entry); setIsDirty(false); setNotice(deleted ? '已移入回收站。' : '已从回收站恢复。')
    } catch (reason) { setNotice(''); setError(messageFor(parseFailure(reason))) } finally { setSaving(false) }
  }

  async function purge() {
    if (!entry || !window.confirm('确定永久删除这封心笺吗？此操作无法恢复，且只会删除这封已回收的记录。')) return
    setSaving(true); setError(''); setNotice('正在永久删除…')
    try {
      const response = await fetch(`/api/journal/entries/${entry.id}`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: entry.version }) })
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw parseFailure(payload)
      if (signedDraftKey) sessionStorage.removeItem(signedDraftKey)
      setIsDirty(false); router.replace('/journal')
    } catch (reason) { setNotice(''); setError(messageFor(parseFailure(reason))) } finally { setSaving(false) }
  }

  async function sendLoginLink(event: FormEvent) {
    event.preventDefault()
    if (!isSupabaseConfigured || !loginEmail.trim()) return
    sessionStorage.setItem(loginDraftKey, JSON.stringify({ entryId: entryId ?? null, draft }))
    setSendingLogin(true); setError('')
    try {
      const destination = `${window.location.origin}/auth/callback?next=${encodeURIComponent(`/journal${entryId ? `/entries/${entryId}` : ''}?draftId=${draftId}`)}`
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
      {error && <StatusMessage kind="error">{error}</StatusMessage>}
      {readOnly && <StatusMessage kind="empty">这封心笺已在回收站。恢复后才能编辑或用于问道。</StatusMessage>}
      <form onSubmit={save} className={styles.form}>
        <label>题目（可选）<input value={draft.title} maxLength={60} disabled={readOnly || loading} onChange={e => updateDraft({ title: e.target.value })} placeholder="给这一刻取个名字" /></label>
        <label>正文 <span className={styles.required}>必填</span><textarea value={draft.body} minLength={1} maxLength={10_000} required disabled={readOnly || loading} onChange={e => updateDraft({ body: e.target.value })} placeholder="此刻，什么让你挂心？" /></label>
        <p className={styles.counter}>{draft.body.trim().length}/10000</p>
        <details className={styles.more}><summary>更多选项</summary><div className={styles.moreFields}>
          <label>心情（可选）<select value={draft.mood} disabled={readOnly || loading} onChange={e => updateDraft({ mood: e.target.value as Mood | '' })}><option value="">不标记</option>{moods.map(mood => <option key={mood.value} value={mood.value}>{mood.label}</option>)}</select></label>
          <label>所属卷册 ID（可选）<input value={draft.volumeId} disabled={readOnly || loading} onChange={e => updateDraft({ volumeId: e.target.value })} placeholder="可在卷册创建后填写" /></label>
        </div></details>
        {!readOnly && <PrimaryButton type="submit" disabled={saving || loading}>{saving ? '正在保存…' : entry ? '保存修改' : '保存心笺'}</PrimaryButton>}
      </form>
      {!authKnown ? <StatusMessage kind="loading">正在确认登录状态…</StatusMessage> : !userId && isSupabaseConfigured && !readOnly && <form className={styles.login} onSubmit={sendLoginLink}><label>登录后保存 <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" /></label><button type="submit" disabled={sendingLogin}>{sendingLogin ? '正在发送…' : '登录并保存草稿'}</button><p>点击即同意仅在此浏览器的原标签页暂存草稿，以完成登录。</p></form>}
      {entry && <div className={styles.danger}>{readOnly ? <><button type="button" onClick={() => void setRecycled(false)} disabled={saving}>恢复记录</button><button type="button" onClick={() => void purge()} disabled={saving}>永久删除</button></> : <button type="button" onClick={() => void setRecycled(true)} disabled={saving}>移入回收站</button>}</div>}
      {isDirty && <p className={styles.unsaved} role="status">有未保存的修改，离开页面前会提醒你。</p>}
    </PaperPanel>
  </main>
}

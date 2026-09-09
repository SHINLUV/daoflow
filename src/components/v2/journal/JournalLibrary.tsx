'use client'

import Link from 'next/link'
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { Entry, Favorite, TimelineItem, Volume } from '@/lib/journal/contracts'
import { PrimaryButton } from '@/components/v2/shared/PrimaryButton'
import { PaperPanel } from '@/components/v2/shared/PaperPanel'
import { StatusMessage } from '@/components/v2/shared/StatusMessage'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { InputRevision, PrivateDataEpoch } from '@/lib/journal/entries'
import styles from './journal.module.css'

type MainTab = 'entries' | 'volumes' | 'favorites'
type EntryKind = 'all' | 'entry' | 'ask' | 'trash'
type FailedAction = { kind: 'load' } | { kind: 'create-volume'; payload: { id: string; title: string } } | { kind: 'trash'; entry: Entry; action: 'restore' | 'purge' } | { kind: 'export'; from: string; to: string }

function newId() { return crypto.randomUUID() }
function failureMessage(payload: unknown, fallback: string) {
  return payload && typeof payload === 'object' && 'error' in payload
    ? (payload as { error?: { message?: string } }).error?.message || fallback
    : fallback
}

export function JournalLibrary() {
  const [supabase] = useState(() => createClient())
  const [authKnown, setAuthKnown] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [tab, setTab] = useState<MainTab>('entries')
  const [entryKind, setEntryKind] = useState<EntryKind>('all')
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [trash, setTrash] = useState<Entry[]>([])
  const [volumes, setVolumes] = useState<Volume[]>([])
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [queryInput, setQueryInput] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [title, setTitle] = useState('')
  const titleRef = useRef('')
  const titleRevision = useRef(new InputRevision())
  const pendingVolume = useRef<{ id: string; title: string } | null>(null)
  const requestSequence = useRef(0)
  const privateEpoch = useRef(new PrivateDataEpoch())
  const requests = useRef(new Set<AbortController>())
  const [failedAction, setFailedAction] = useState<FailedAction | null>(null)
  const [acting, setActing] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState('')

  const clearPrivateUi = useCallback(() => {
    requests.current.forEach(controller => controller.abort()); requests.current.clear()
    requestSequence.current += 1
    setTimeline([]); setTrash([]); setVolumes([]); setFavorites([]); setNextCursor(null)
    titleRef.current = ''; titleRevision.current.bump(); setTitle(''); pendingVolume.current = null; setError(''); setNotice(''); setExportStatus(''); setFailedAction(null)
    setLoading(false); setLoadingMore(false); setActing(false); setExporting(false)
  }, [])

  const acceptOwner = useCallback((nextOwnerId: string | null) => {
    if (privateEpoch.current.acceptOwner(nextOwnerId)) clearPrivateUi()
    setUserId(nextOwnerId); setAuthKnown(true)
  }, [clearPrivateUi])

  useEffect(() => {
    if (!isSupabaseConfigured) { acceptOwner(null); setError('私人记录服务尚未配置。'); return }
    const requestSet = requests.current
    let active = true
    let authRevision = 0
    const refresh = async () => {
      const revision = ++authRevision
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }))
      if (active && revision === authRevision) acceptOwner(data.user?.id ?? null)
    }
    void refresh()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { authRevision += 1; acceptOwner(session?.user?.id ?? null) })
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('focus', onFocus); requestSet.forEach(controller => controller.abort()) }
  }, [acceptOwner, supabase])

  function beginPrivateRequest() {
    const controller = new AbortController(); requests.current.add(controller)
    return { controller, token: privateEpoch.current.capture() }
  }

  const load = useCallback(async (cursor: string | null = null) => {
    if (!userId) { setLoading(false); return }
    const sequence = ++requestSequence.current
    const request = beginPrivateRequest()
    if (cursor) setLoadingMore(true)
    else setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (cursor) params.set('cursor', cursor)
      if (query && tab !== 'favorites') params.set('q', query)
      let endpoint = '/api/journal/favorites'
      if (tab === 'volumes') endpoint = '/api/journal/volumes'
      if (tab === 'entries' && entryKind === 'trash') {
        params.set('filter', 'trash')
        endpoint = '/api/journal/entries'
      } else if (tab === 'entries') {
        params.set('kind', entryKind)
        endpoint = '/api/journal/timeline'
      }
      const response = await fetch(`${endpoint}?${params}`, { cache: 'no-store', signal: request.controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(failureMessage(payload, '暂时无法读取私人内容。'))
      if (sequence !== requestSequence.current || !privateEpoch.current.isCurrent(request.token)) return
      const items = payload.items ?? []
      if (tab === 'volumes') setVolumes(current => cursor ? Array.from(new Map([...current, ...items].map(item => [item.id, item])).values()) : items)
      else if (tab === 'favorites') setFavorites(current => cursor ? Array.from(new Map([...current, ...items].map(item => [item.id, item])).values()) : items)
      else if (entryKind === 'trash') setTrash(current => cursor ? Array.from(new Map([...current, ...items].map(item => [item.id, item])).values()) : items)
      else setTimeline(current => cursor ? Array.from(new Map([...current, ...items].map(item => [`${item.type}:${item.id}`, item])).values()) : items)
      setNextCursor(payload.nextCursor ?? null)
      setFailedAction(null)
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      if (sequence === requestSequence.current && privateEpoch.current.isCurrent(request.token)) { setError(reason instanceof Error ? reason.message : '暂时无法读取私人内容。'); setFailedAction({ kind: 'load' }) }
    } finally {
      requests.current.delete(request.controller)
      if (sequence === requestSequence.current && privateEpoch.current.isCurrent(request.token)) { setLoading(false); setLoadingMore(false) }
    }
  }, [entryKind, query, tab, userId])

  useEffect(() => {
    if (!authKnown) return
    if (!userId) { setLoading(false); if (isSupabaseConfigured) setError('请先登录后查看私人记录。'); return }
    void load()
  }, [authKnown, load, userId])

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setNotice('')
    setQuery(queryInput.trim())
  }

  function clearSearch() {
    setQueryInput('')
    setQuery('')
    setNotice('')
  }

  async function createVolume(event?: FormEvent, retryPayload?: { id: string; title: string }) {
    event?.preventDefault()
    const normalized = title.trim()
    if (!retryPayload && !normalized) return
    if (retryPayload) pendingVolume.current = retryPayload
    else if (!pendingVolume.current || pendingVolume.current.title !== normalized) pendingVolume.current = { id: newId(), title: normalized }
    const requestPayload = pendingVolume.current
    const revision = titleRevision.current.capture()
    const request = beginPrivateRequest(); setActing(true); setError(''); setNotice(''); setFailedAction(null)
    try {
      const response = await fetch('/api/journal/volumes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(requestPayload), signal: request.controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(failureMessage(payload, '卷册未能保存。'))
      if (!privateEpoch.current.isCurrent(request.token)) return
      const inputUnchanged = titleRevision.current.isCurrent(revision)
      if (inputUnchanged) { pendingVolume.current = null; titleRef.current = ''; titleRevision.current.bump(); setTitle('') }
      setNotice(inputUnchanged ? '卷册已创建。' : '提交时的卷册已创建；你后来输入的标题仍保留在输入框中。'); await load()
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setError(reason instanceof Error ? reason.message : '卷册未能保存。'); setFailedAction(titleRevision.current.isCurrent(revision) ? { kind: 'create-volume', payload: requestPayload } : null) }
    } finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setActing(false) }
  }

  async function changeTrash(entry: Entry, action: 'restore' | 'purge') {
    if (action === 'purge' && !window.confirm(`确定永久删除“${entry.title || '无题心笺'}”吗？此操作无法恢复。`)) return
    const request = beginPrivateRequest(); setActing(true); setError(''); setNotice(''); setFailedAction(null)
    try {
      const response = await fetch(`/api/journal/entries/${entry.id}`, { method: action === 'purge' ? 'DELETE' : 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action === 'purge' ? { version: entry.version } : { version: entry.version, deleted: false }), signal: request.controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(failureMessage(payload, action === 'purge' ? '永久删除未完成。' : '恢复未完成。'))
      if (!privateEpoch.current.isCurrent(request.token)) return
      setTrash(current => current.filter(item => item.id !== entry.id)); setNotice(action === 'purge' ? '心笺已永久删除。' : '心笺已恢复，可在记录中查看。')
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setError(reason instanceof Error ? reason.message : '操作未完成。'); setFailedAction({ kind: 'trash', entry, action }) }
    } finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setActing(false) }
  }

  async function exportJournal(range = { from: exportFrom, to: exportTo }) {
    const request = beginPrivateRequest()
    setExporting(true); setExportStatus(''); setError('')
    try {
      const params = new URLSearchParams()
      if (range.from) params.set('from', new Date(`${range.from}T00:00:00`).toISOString())
      if (range.to) params.set('to', new Date(`${range.to}T00:00:00`).toISOString())
      const response = await fetch(`/api/journal/export?${params}`, { cache: 'no-store', signal: request.controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(failureMessage(payload, '导出未完成。'))
      if (!privateEpoch.current.isCurrent(request.token)) return
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `daoflow-journal-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      setExportStatus('JSON 已生成并开始下载。')
      setFailedAction(null)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setError(reason instanceof Error ? reason.message : '导出未完成。'); setFailedAction({ kind: 'export', from: range.from, to: range.to }) }
    } finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setExporting(false) }
  }

  function retryFailedAction() {
    if (!failedAction) return
    if (failedAction.kind === 'load') void load()
    else if (failedAction.kind === 'create-volume') void createVolume(undefined, failedAction.payload)
    else if (failedAction.kind === 'trash') void changeTrash(failedAction.entry, failedAction.action)
    else void exportJournal({ from: failedAction.from, to: failedAction.to })
  }

  const searchable = tab === 'entries' || tab === 'volumes'
  const visibleCount = tab === 'volumes' ? volumes.length : tab === 'favorites' ? favorites.length : entryKind === 'trash' ? trash.length : timeline.length

  return <main className={styles.page}><PaperPanel className={styles.paper}>
    <header className={styles.heading}><p className={styles.kicker}>我的卷册</p><h1>把每一件事，慢慢理成一卷</h1><p>记录、问道与收藏只属于你自己。</p></header>
    <div className={styles.tabs}>{(['entries', 'volumes', 'favorites'] as const).map(value => <button key={value} onClick={() => { setTab(value); setNotice('') }} aria-current={tab === value}>{value === 'entries' ? '记录' : value === 'volumes' ? '卷册' : '收藏'}</button>)}</div>
    {tab === 'entries' && <div className={styles.filters} aria-label="记录筛选">{(['all', 'entry', 'ask', 'trash'] as const).map(value => <button key={value} type="button" aria-pressed={entryKind === value} onClick={() => { setEntryKind(value); setNotice('') }}>{value === 'all' ? '全部' : value === 'entry' ? '心笺' : value === 'ask' ? '问道' : '回收站'}</button>)}</div>}
    {searchable && <form className={styles.searchForm} onSubmit={submitSearch}><label className={styles.srOnly} htmlFor="journal-search">搜索</label><input id="journal-search" value={queryInput} maxLength={100} onChange={event => setQueryInput(event.target.value)} placeholder={tab === 'volumes' ? '搜索卷册标题' : '搜索心笺与问道'} /><PrimaryButton type="submit">搜索</PrimaryButton>{query && <button type="button" onClick={clearSearch}>清空</button>}</form>}
    {error && <StatusMessage kind="error">{error} {failedAction && <button type="button" onClick={retryFailedAction}>重试刚才的操作</button>}</StatusMessage>}
    {notice && <StatusMessage kind="success">{notice}</StatusMessage>}
    {loading ? <StatusMessage kind="loading">正在翻阅你的目录…</StatusMessage> : <>
      {tab === 'entries' && <>
        <Link className={styles.newLink} href="/journal/new">新建心笺</Link>
        <div className={styles.catalog}>
          {entryKind === 'trash' ? trash.map(entry => <div className={styles.catalogRow} key={entry.id}><Link href={`/journal/entries/${entry.id}`}><strong>{entry.title || '无题心笺'}</strong><span>{entry.body.slice(0, 56)}{entry.body.length > 56 ? '…' : ''}</span><time>{new Date(entry.updatedAt).toLocaleDateString('zh-CN')}</time></Link><div className={styles.rowActions}><button type="button" disabled={acting} onClick={() => void changeTrash(entry, 'restore')}>恢复</button><button type="button" disabled={acting} className={styles.destructive} onClick={() => void changeTrash(entry, 'purge')}>永久删除</button></div></div>)
            : timeline.map(item => item.type === 'entry'
              ? <Link key={`e-${item.id}`} href={`/journal/entries/${item.id}`}><strong>{item.entry.title || '无题心笺'}</strong><span>{item.entry.body.slice(0, 56)}{item.entry.body.length > 56 ? '…' : ''}</span><time>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time></Link>
              : <Link key={`a-${item.id}`} href={`/ask?sessionId=${item.id}`}><strong>问道</strong><span>{item.question}</span><time>{new Date(item.createdAt).toLocaleDateString('zh-CN')}</time></Link>)}
        </div>
      </>}
      {tab === 'volumes' && <>
        <form className={styles.inlineForm} onSubmit={createVolume}><input value={title} maxLength={60} onChange={event => { titleRef.current = event.target.value; titleRevision.current.bump(); setTitle(event.target.value); if (pendingVolume.current?.title !== event.target.value.trim()) pendingVolume.current = null; if (failedAction?.kind === 'create-volume') setFailedAction(null) }} placeholder="新卷册，例如：工作去留" /><PrimaryButton type="submit" disabled={acting}>新建卷册</PrimaryButton></form>
        <div className={styles.catalog}>{volumes.map(volume => <Link key={volume.id} href={`/journal/volumes/${volume.id}`}><strong>{volume.title}{volume.archivedAt ? ' · 已归档' : ''}</strong><span>{volume.entryCount} 条心笺</span><time>{new Date(volume.updatedAt).toLocaleDateString('zh-CN')}</time></Link>)}</div>
      </>}
      {tab === 'favorites' && <div className={styles.catalog}>{favorites.map(favorite => <Link key={favorite.id} href={`/chapters/${favorite.chapterId}`}><strong>第 {favorite.chapterId} 章</strong><span>{favorite.excerpt.slice(0, 60)}</span></Link>)}</div>}
      {!visibleCount && !error && <StatusMessage kind="empty">{query ? '没有找到符合条件的内容。' : entryKind === 'trash' && tab === 'entries' ? '回收站是空的。' : '这里还没有内容。'}</StatusMessage>}
      {nextCursor && <button type="button" className={styles.loadMore} disabled={loadingMore || acting} onClick={() => void load(nextCursor)}>{loadingMore ? '正在继续加载…' : '继续加载'}</button>}
    </>}
    <details className={styles.exportPanel}><summary>导出我的数据</summary><p>导出本人心笺、卷册、收藏和问道关联。结束日期不包含当天。</p><div className={styles.rangeFields}><label>开始日期<input type="date" value={exportFrom} onChange={event => { setExportFrom(event.target.value); setExportStatus('') }} /></label><label>结束日期（不含）<input type="date" value={exportTo} min={exportFrom || undefined} onChange={event => { setExportTo(event.target.value); setExportStatus('') }} /></label></div><button type="button" disabled={exporting} onClick={() => void exportJournal()}>{exporting ? '正在生成…' : '下载 JSON'}</button>{exportStatus && <p role="status">{exportStatus}</p>}</details>
  </PaperPanel></main>
}

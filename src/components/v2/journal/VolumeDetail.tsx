'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { TimelineItem, Volume } from '@/lib/journal/contracts'
import { PaperPanel } from '@/components/v2/shared/PaperPanel'
import { PrimaryButton } from '@/components/v2/shared/PrimaryButton'
import { StatusMessage } from '@/components/v2/shared/StatusMessage'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { InputRevision, PrivateDataEpoch } from '@/lib/journal/entries'
import styles from './journal.module.css'

function message(payload: unknown, fallback: string) {
  return payload && typeof payload === 'object' && 'error' in payload
    ? (payload as { error?: { message?: string } }).error?.message || fallback
    : fallback
}

export function VolumeDetail({ id }: { id: string }) {
  const [supabase] = useState(() => createClient())
  const [authKnown, setAuthKnown] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [volume, setVolume] = useState<Volume | null>(null)
  const [items, setItems] = useState<TimelineItem[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [timelineError, setTimelineError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [titleDirty, setTitleDirty] = useState(false)
  const titleDirtyRef = useRef(false)
  const titleRef = useRef('')
  const titleRevision = useRef(new InputRevision())
  const [conflict, setConflict] = useState(false)
  const [failedAction, setFailedAction] = useState<{ kind: 'load' | 'timeline' } | { kind: 'patch'; body: { title?: string; archived?: boolean } } | { kind: 'move'; item: Extract<TimelineItem, { type: 'entry' }> } | null>(null)
  const privateEpoch = useRef(new PrivateDataEpoch())
  const requests = useRef(new Set<AbortController>())

  const clearPrivateUi = useCallback(() => {
    requests.current.forEach(controller => controller.abort()); requests.current.clear()
    setVolume(null); setItems([]); setTitle(''); titleRef.current = ''; titleRevision.current.bump(); setTitleDirty(false); titleDirtyRef.current = false
    setError(''); setTimelineError(''); setNotice(''); setNextCursor(null); setLoading(false); setLoadingMore(false); setSaving(false); setConflict(false); setFailedAction(null)
  }, [])

  const acceptOwner = useCallback((nextOwnerId: string | null) => {
    if (privateEpoch.current.acceptOwner(nextOwnerId)) clearPrivateUi()
    setUserId(nextOwnerId); setAuthKnown(true)
  }, [clearPrivateUi])

  useEffect(() => {
    if (!isSupabaseConfigured) { acceptOwner(null); setError('私人卷册服务尚未配置。'); return }
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

  const loadTimeline = useCallback(async (cursor: string | null = null) => {
    if (!userId) return
    const request = beginPrivateRequest()
    if (cursor) setLoadingMore(true)
    else setLoading(true)
    setTimelineError('')
    try {
      const params = new URLSearchParams()
      if (cursor) params.set('cursor', cursor)
      const response = await fetch(`/api/journal/volumes/${id}/timeline?${params}`, { cache: 'no-store', signal: request.controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(message(payload, '暂时无法读取卷内时间线。'))
      if (!privateEpoch.current.isCurrent(request.token)) return
      const pageItems = (payload.items ?? []) as TimelineItem[]
      setItems(current => {
        const combined: TimelineItem[] = cursor ? [...current, ...pageItems] : pageItems
        return Array.from(new Map<string, TimelineItem>(combined.map(item => [`${item.type}:${item.id}`, item])).values())
      })
      setNextCursor(payload.nextCursor ?? null)
      setFailedAction(null)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setTimelineError(reason instanceof Error ? reason.message : '暂时无法读取卷内时间线。'); setFailedAction({ kind: 'timeline' }) }
    } finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) { setLoading(false); setLoadingMore(false) } }
  }, [id, userId])

  const load = useCallback(async (replaceLocalTitle = false) => {
    if (!userId) return
    const request = beginPrivateRequest()
    setLoading(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/journal/volumes/${id}`, { cache: 'no-store', signal: request.controller.signal })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(message(payload, '暂时无法打开卷册。'))
      if (!privateEpoch.current.isCurrent(request.token)) return
      const loaded = payload.volume as Volume
      setVolume(loaded)
      if (!titleDirtyRef.current || replaceLocalTitle) { titleRef.current = loaded.title; titleRevision.current.bump(); setTitle(loaded.title); setTitleDirty(false); titleDirtyRef.current = false }
      await loadTimeline()
      if (!loaded.archivedAt && privateEpoch.current.isCurrent(request.token)) {
        const preference = await fetch('/api/journal/preferences', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ lastVolumeId: id }), signal: request.controller.signal })
        if (!preference.ok && privateEpoch.current.isCurrent(request.token)) setNotice('卷册已打开，但未能更新“上次翻到”的位置。')
      }
      setConflict(false); setFailedAction(null)
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setError(reason instanceof Error ? reason.message : '暂时无法打开卷册。'); setFailedAction({ kind: 'load' }) }
    } finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setLoading(false) }
  }, [id, loadTimeline, userId])

  useEffect(() => {
    if (!authKnown) return
    if (!userId) { setLoading(false); if (isSupabaseConfigured) setError('请先登录后打开卷册。'); return }
    void load()
  }, [authKnown, load, userId])

  async function patch(body: { title?: string; archived?: boolean }) {
    if (!volume) return
    const request = beginPrivateRequest()
    const revision = titleRevision.current.capture()
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/journal/volumes/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: volume.version, ...body }), signal: request.controller.signal,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) { if (payload.error?.code === 'VERSION_CONFLICT') setConflict(true); throw new Error(message(payload, '卷册未能更新。')) }
      if (!privateEpoch.current.isCurrent(request.token)) return
      const updated = { ...(payload.volume as Volume), entryCount: volume.entryCount }
      setVolume(updated)
      if (body.title !== undefined && titleRevision.current.isCurrent(revision)) { titleRef.current = updated.title; titleRevision.current.bump(); setTitle(updated.title); setTitleDirty(false); titleDirtyRef.current = false }
      else if (body.title !== undefined) { const dirty = titleRef.current !== updated.title; setTitleDirty(dirty); titleDirtyRef.current = dirty }
      setConflict(false); setFailedAction(null)
      setNotice(body.archived === true ? '卷册已归档，内容仍可阅读和移出。' : body.archived === false ? '卷册已恢复。' : '卷册名称已更新。')
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setError(reason instanceof Error ? reason.message : '卷册未能更新。'); setFailedAction(body.title === undefined || titleRevision.current.isCurrent(revision) ? { kind: 'patch', body } : null) } }
    finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setSaving(false) }
  }

  async function rename(event: FormEvent) {
    event.preventDefault()
    await patch({ title })
  }

  async function moveOut(item: Extract<TimelineItem, { type: 'entry' }>) {
    const request = beginPrivateRequest()
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/journal/entries/${item.id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ version: item.entry.version, volumeId: null }), signal: request.controller.signal,
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(message(payload, '未能移出这封心笺。'))
      if (!privateEpoch.current.isCurrent(request.token)) return
      setItems(current => current.filter(currentItem => !(currentItem.type === 'entry' && currentItem.id === item.id)))
      setVolume(current => current ? { ...current, entryCount: Math.max(0, current.entryCount - 1) } : current)
      setNotice('心笺已移出本卷，内容没有删除。')
      setFailedAction(null)
    } catch (reason) { if (!(reason instanceof DOMException && reason.name === 'AbortError') && privateEpoch.current.isCurrent(request.token)) { setError(reason instanceof Error ? reason.message : '未能移出这封心笺。'); setFailedAction({ kind: 'move', item }) } }
    finally { requests.current.delete(request.controller); if (privateEpoch.current.isCurrent(request.token)) setSaving(false) }
  }

  function retryFailedAction() {
    if (!failedAction) return
    switch (failedAction.kind) {
      case 'load': void load(); break
      case 'timeline': void loadTimeline(); break
      case 'patch': void patch(failedAction.body); break
      case 'move': void moveOut(failedAction.item); break
    }
  }

  return <main className={styles.page}><PaperPanel className={styles.paper}>
    {error && <StatusMessage kind="error">{error} {failedAction && <button type="button" onClick={retryFailedAction}>重试刚才的操作</button>} {conflict && <button type="button" onClick={() => { if (!titleDirty || window.confirm('加载远端卷册会放弃未保存的标题，确定吗？')) void load(true) }}>加载远端卷册</button>}</StatusMessage>}
    {notice && <StatusMessage kind="success">{notice}</StatusMessage>}
    {!volume && loading ? <StatusMessage kind="loading">正在打开卷册…</StatusMessage> : volume && <>
      <header className={styles.heading}><p className={styles.kicker}>一事一卷</p><h1>{volume.title}</h1><p>{volume.archivedAt ? '此卷已归档，仍可阅读和移出记录。' : '记录在这里按时间展开。'}</p></header>
      <form className={styles.inlineForm} onSubmit={rename}><input value={title} maxLength={60} onChange={event => { const dirty = event.target.value !== volume.title; titleRef.current = event.target.value; titleRevision.current.bump(); setTitle(event.target.value); setTitleDirty(dirty); titleDirtyRef.current = dirty; if (failedAction?.kind === 'patch' && failedAction.body.title !== undefined) setFailedAction(null) }} /><PrimaryButton type="submit" disabled={saving || !title.trim() || !titleDirty}>保存名称</PrimaryButton><button type="button" disabled={saving || titleDirty} title={titleDirty ? '请先保存或还原标题' : undefined} onClick={() => void patch({ archived: !volume.archivedAt })}>{volume.archivedAt ? '恢复卷册' : '归档卷册'}</button></form>
      {titleDirty && <p className={styles.unsaved}>名称尚未保存；保存名称后才能归档或恢复。</p>}
      {!volume.archivedAt && <Link className={styles.newLink} href={`/journal/new?volumeId=${volume.id}`}>在此卷新建心笺</Link>}
      {timelineError && <StatusMessage kind="error">{timelineError} <button type="button" onClick={() => void loadTimeline()}>重试时间线</button></StatusMessage>}
      {loading && !items.length ? <StatusMessage kind="loading">正在展开卷内记录…</StatusMessage> : <div className={styles.catalog}>{items.map(item => item.type === 'entry'
        ? <div className={styles.catalogRow} key={`e-${item.id}`}><Link href={`/journal/entries/${item.id}`}><strong>{item.entry.title || '无题心笺'}</strong><span>{item.entry.body.slice(0, 70)}</span><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></Link><div className={styles.rowActions}><button type="button" disabled={saving} onClick={() => void moveOut(item)}>移出本卷</button></div></div>
        : <Link key={`a-${item.id}`} href={`/ask?sessionId=${item.id}`}><strong>问道</strong><span>{item.question}</span><time>{new Date(item.createdAt).toLocaleString('zh-CN')}</time></Link>)}</div>}
      {!loading && !timelineError && !items.length && <StatusMessage kind="empty">这卷还没有记录。</StatusMessage>}
      {nextCursor && <button type="button" className={styles.loadMore} disabled={loadingMore} onClick={() => void loadTimeline(nextCursor)}>{loadingMore ? '正在继续加载…' : '继续加载'}</button>}
    </>}
  </PaperPanel></main>
}

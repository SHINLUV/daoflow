'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { ApiError, Favorite, Page } from '@/lib/journal/contracts'
import { createFavoriteOwnerCoordinator } from '@/lib/journal/favorites'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { isOwnerEpochCurrent, nextOwnerEpoch, type OwnerEpoch } from '@/lib/journal/ask-requests'
import styles from './reading.module.css'

type FavoriteControlsProps = { chapterId: number; originalText: string }
type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null

export function FavoriteControls({ chapterId, originalText }: FavoriteControlsProps) {
  const [supabase] = useState(() => createClient())
  const ownerEpochRef = useRef<OwnerEpoch>({ ownerId: null, epoch: 0 })
  const controllersRef = useRef(new Set<AbortController>())
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [editing, setEditing] = useState<Favorite | null>(null)
  const [note, setNote] = useState('')

  const beginOperation = useCallback(() => {
    const controller = new AbortController()
    controllersRef.current.add(controller)
    return { controller, ownerEpoch: ownerEpochRef.current }
  }, [])
  const endOperation = useCallback((controller: AbortController) => { controllersRef.current.delete(controller) }, [])
  const isCurrentOperation = useCallback((ownerEpoch: OwnerEpoch) => isOwnerEpochCurrent(ownerEpochRef.current, ownerEpoch), [])

  const loadFavorites = useCallback(async () => {
    const operation = beginOperation()
    setLoading(true)
    try {
      const response = await fetch(`/api/journal/favorites?chapterId=${chapterId}`, { cache: 'no-store', signal: operation.controller.signal })
      if (!isCurrentOperation(operation.ownerEpoch)) return
      if (response.ok) {
        const page = await response.json() as Page<Favorite>
        if (!isCurrentOperation(operation.ownerEpoch)) return
        setFavorites(page.items)
        setNotice(null)
      } else {
        const error = await readApiError(response)
        if (!isCurrentOperation(operation.ownerEpoch)) return
        setFavorites([])
        setNotice({ kind: 'info', text: error ?? '登录后可以保存收藏与批注。' })
      }
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setNotice({ kind: 'error', text: '无法连接收藏服务；原文仍可继续阅读。' })
    } finally {
      endOperation(operation.controller)
      if (isCurrentOperation(operation.ownerEpoch)) setLoading(false)
    }
  }, [beginOperation, chapterId, endOperation, isCurrentOperation])

  useEffect(() => {
    if (!isSupabaseConfigured) { void loadFavorites(); return }
    let active = true
    const controllers = controllersRef.current
    const changeOwner = (nextOwner: string | null) => {
      if (!active || ownerEpochRef.current.ownerId === nextOwner) return false
      controllers.forEach(controller => controller.abort())
      controllers.clear()
      ownerEpochRef.current = nextOwnerEpoch(ownerEpochRef.current, nextOwner)
      setFavorites([]); setEditing(null); setNote('')
      setNotice(nextOwner ? { kind: 'info', text: '账户已变化，正在重新读取该账户的收藏。' } : { kind: 'info', text: '已退出登录，收藏与批注已从当前页面清除。' })
      void loadFavorites()
      return true
    }
    const ownerCoordinator = createFavoriteOwnerCoordinator(changeOwner, () => { if (active) void loadFavorites() })
    void supabase.auth.getUser().then(({ data }) => {
      ownerCoordinator.resolveGetUser(data.user?.id ?? null)
    }).catch(() => {
      ownerCoordinator.resolveGetUser(null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      ownerCoordinator.observe(session?.user?.id ?? null)
    })
    return () => { active = false; controllers.forEach(controller => controller.abort()); controllers.clear(); subscription.unsubscribe() }
  }, [loadFavorites, supabase])

  async function createFavorite(excerpt: string) {
    if (!excerpt || !originalText.includes(excerpt)) {
      setNotice({ kind: 'error', text: '请先在本章原文中选择连续文字。' })
      return
    }
    const operation = beginOperation()
    setPending(true)
    try {
      const response = await fetch('/api/journal/favorites', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: crypto.randomUUID(), chapterId, excerpt, note: null }), signal: operation.controller.signal,
      })
      if (!isCurrentOperation(operation.ownerEpoch)) return
      if (!response.ok) {
        const error = await readApiError(response); if (!isCurrentOperation(operation.ownerEpoch)) return
        setNotice({ kind: 'error', text: error ?? '收藏没有保存，请稍后重试。' })
        return
      }
      const { favorite } = await response.json() as { favorite: Favorite }
      if (!isCurrentOperation(operation.ownerEpoch)) return
      setFavorites(current => current.some(item => item.id === favorite.id) ? current : [favorite, ...current])
      setNotice({ kind: 'success', text: '已保存到我的收藏。' })
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setNotice({ kind: 'error', text: '网络中断，未假称收藏成功；请检查连接后重试。' })
    } finally {
      endOperation(operation.controller); if (isCurrentOperation(operation.ownerEpoch)) setPending(false)
    }
  }

  function createSelectionFavorite() {
    const selection = window.getSelection()?.toString() ?? ''
    void createFavorite(selection)
  }

  function startEditing(favorite: Favorite) {
    setEditing(favorite)
    setNote(favorite.note ?? '')
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    const operation = beginOperation(); setPending(true)
    try {
      const response = await fetch(`/api/journal/favorites/${editing.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: editing.version, note: note || null }), signal: operation.controller.signal,
      })
      if (!isCurrentOperation(operation.ownerEpoch)) return
      if (!response.ok) {
        const error = await readApiError(response); if (!isCurrentOperation(operation.ownerEpoch)) return
        setNotice({ kind: 'error', text: error ?? '批注没有保存，请保留输入后刷新再试。' })
        return
      }
      const { favorite } = await response.json() as { favorite: Favorite }
      if (!isCurrentOperation(operation.ownerEpoch)) return
      setFavorites(current => current.map(item => item.id === favorite.id ? favorite : item))
      setEditing(null)
      setNotice({ kind: 'success', text: '批注已保存。' })
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setNotice({ kind: 'error', text: '网络中断，批注仍保留在输入框中。' })
    } finally {
      endOperation(operation.controller); if (isCurrentOperation(operation.ownerEpoch)) setPending(false)
    }
  }

  async function removeFavorite(favorite: Favorite) {
    const operation = beginOperation(); setPending(true)
    try {
      const response = await fetch(`/api/journal/favorites/${favorite.id}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version: favorite.version }), signal: operation.controller.signal,
      })
      if (!isCurrentOperation(operation.ownerEpoch)) return
      if (!response.ok) {
        const error = await readApiError(response); if (!isCurrentOperation(operation.ownerEpoch)) return
        setNotice({ kind: 'error', text: error ?? '取消收藏失败，请刷新后重试。' })
        return
      }
      setFavorites(current => current.filter(item => item.id !== favorite.id))
      if (editing?.id === favorite.id) setEditing(null)
      setNotice({ kind: 'success', text: '已取消收藏。' })
    } catch {
      if (isCurrentOperation(operation.ownerEpoch) && !operation.controller.signal.aborted) setNotice({ kind: 'error', text: '网络中断，未假称已取消收藏。' })
    } finally {
      endOperation(operation.controller); if (isCurrentOperation(operation.ownerEpoch)) setPending(false)
    }
  }

  return <section className={styles.favoritesSection} aria-labelledby="favorites-title">
    <div className={styles.sectionHeading}>
      <h2 id="favorites-title">我的收藏与批注</h2>
      <span className={styles.favoriteCount}>{favorites.length} 条</span>
    </div>
    <p className={styles.favoriteHint}>可收藏整章，或在上方原文中选中连续文字后收藏。</p>
    <div className={styles.favoriteActions}>
      <button type="button" className={styles.primaryButton} disabled={pending} onClick={() => void createFavorite(originalText)}>收藏整章</button>
      <button type="button" className={styles.quietButton} disabled={pending} onClick={createSelectionFavorite}>收藏选中原文</button>
    </div>
    {notice && <p className={`${styles.notice} ${styles[notice.kind]}`} role={notice.kind === 'error' ? 'alert' : 'status'}>{notice.text}</p>}
    {loading ? <p className={styles.loading} role="status">正在读取我的收藏…</p> : favorites.length === 0 ? <p className={styles.empty}>尚未收藏本章原文。</p> : <ul className={styles.favoriteList}>
      {favorites.map(favorite => <li key={favorite.id} data-testid="favorite-item" className={styles.favoriteItem}>
        <p className={styles.favoriteExcerpt}>“{favorite.excerpt}”</p>
        {editing?.id === favorite.id ? <form className={styles.noteForm} onSubmit={saveNote}>
          <label htmlFor={`favorite-note-${favorite.id}`}>我的批注</label>
          <textarea id={`favorite-note-${favorite.id}`} value={note} maxLength={2000} onChange={event => setNote(event.target.value)} />
          <div><button className={styles.primaryButton} disabled={pending} type="submit">保存批注</button><button className={styles.textButton} disabled={pending} type="button" onClick={() => setEditing(null)}>取消编辑</button></div>
        </form> : <>
          <p className={styles.note}>{favorite.note || '尚无批注。'}</p>
          <div className={styles.favoriteItemActions}><button className={styles.textButton} type="button" onClick={() => startEditing(favorite)}>{favorite.note ? '编辑批注' : '添加批注'}</button><button className={styles.textButton} type="button" disabled={pending} onClick={() => void removeFavorite(favorite)}>取消收藏</button></div>
        </>}
      </li>)}
    </ul>}
  </section>
}

async function readApiError(response: Response): Promise<string | null> {
  try {
    const body = await response.json() as ApiError
    return body.error?.message ?? null
  } catch { return null }
}

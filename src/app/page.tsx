'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from '@phosphor-icons/react'
import { NowExperience, type AuthState, type SaveState } from '@/components/v2/home/NowExperience'
import { SixRealms } from '@/components/v2/home/SixRealms'
import { DailyReading } from '@/components/v2/home/DailyReading'
import { AUTH_SYNC_STORAGE_KEY, csrfFetch, getAuthSession } from '@/lib/auth/browser'
import type { CreateEntry } from '@/lib/journal/contracts'
import { useDaoNavigation } from '@/components/v2/motion/MotionProvider'
import styles from '@/components/v2/home/home.module.css'

type LastVolume = { id: string; title: string } | null

function errorMessage(value: unknown) {
  if (value && typeof value === 'object' && 'error' in value) {
    const error = (value as { error?: { message?: unknown } }).error
    if (typeof error?.message === 'string') return error.message
  }
  return '保存没有完成，请检查连接后重试。'
}

export default function HomePage() {
  const [authState, setAuthState] = useState<AuthState>('loading')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [suggestion, setSuggestion] = useState<{ question: string; revision: number }>({ question: '', revision: 0 })
  const [lastVolume, setLastVolume] = useState<LastVolume>(null)
  const { navigate } = useDaoNavigation()
  const savedTimer = useRef<number | null>(null)

  useEffect(() => {
    let active = true
    const refresh = () => { void getAuthSession().then(session => { if (active) setAuthState(session.user ? 'authenticated' : 'anonymous') }).catch(() => { if (active) setAuthState('unavailable') }) }
    refresh()
    const onFocus = () => refresh()
    const onStorage = (event: StorageEvent) => { if (event.key === AUTH_SYNC_STORAGE_KEY) refresh() }
    window.addEventListener('focus', onFocus); window.addEventListener('storage', onStorage)
    return () => { active = false; window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage); if (savedTimer.current) window.clearTimeout(savedTimer.current) }
  }, [])

  useEffect(() => {
    if (authState !== 'authenticated') { setLastVolume(null); return }
    let active = true
    fetch('/api/journal/preferences', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(payload => {
        const volume = payload?.lastVolume
        if (active && volume && typeof volume.id === 'string' && typeof volume.title === 'string') setLastVolume(volume)
      }).catch(() => {})
    return () => { active = false }
  }, [authState])

  async function saveDraft(draft: CreateEntry) {
    setSaveState('saving')
    try {
      const response = await csrfFetch('/api/journal/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(errorMessage(payload))
      setSaveState('saved')
      if (savedTimer.current) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaveState('idle'), 2_400)
    } catch (error) {
      setSaveState('error')
      throw error
    }
  }

  function ask(question: string) {
    window.sessionStorage.setItem('daoflow:ask:draft', question)
    navigate('/ask')
  }

  return <main id="main-content">
    {lastVolume && <aside className={styles.returnStrip} aria-label="继续上次打开的卷册"><span>上次翻到</span><Link href={`/journal/volumes/${lastVolume.id}`}>{lastVolume.title}<ArrowUpRight size={15} /></Link></aside>}
    <NowExperience onSaveDraft={saveDraft} onAsk={ask} saveState={saveState} authState={authState} suggestedQuestion={suggestion.question} suggestionRevision={suggestion.revision} />
    <SixRealms onChooseQuestion={question => setSuggestion(previous => ({ question, revision: previous.revision + 1 }))} />
    <DailyReading />
  </main>
}

'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from '@phosphor-icons/react'
import { NowExperience, type AuthState, type SaveState } from '@/components/v2/home/NowExperience'
import { SixRealms } from '@/components/v2/home/SixRealms'
import { DailyReading } from '@/components/v2/home/DailyReading'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
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
  const [supabase] = useState(() => createClient())
  const [authState, setAuthState] = useState<AuthState>(isSupabaseConfigured ? 'loading' : 'unavailable')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [suggestedQuestion, setSuggestedQuestion] = useState<string | null>(null)
  const [lastVolume, setLastVolume] = useState<LastVolume>(null)
  const { navigate } = useDaoNavigation()
  const savedTimer = useRef<number | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return
      if (error) { setAuthState('unavailable'); return }
      setAuthState(data.user ? 'authenticated' : 'anonymous')
    }).catch(() => { if (active) setAuthState('unavailable') })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthState(session?.user ? 'authenticated' : 'anonymous')
    })
    return () => { active = false; subscription.unsubscribe(); if (savedTimer.current) window.clearTimeout(savedTimer.current) }
  }, [supabase])

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
      const response = await fetch('/api/journal/entries', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) })
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
    <NowExperience onSaveDraft={saveDraft} onAsk={ask} saveState={saveState} authState={authState} suggestedQuestion={suggestedQuestion} />
    <SixRealms onChooseQuestion={question => setSuggestedQuestion(question)} />
    <DailyReading />
  </main>
}

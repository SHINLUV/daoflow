'use client'

import Image from 'next/image'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, CheckCircle, SpinnerGap } from '@phosphor-icons/react'
import type { CreateEntry } from '@/lib/journal/contracts'
import { PrimaryButton } from '@/components/v2/shared/PrimaryButton'
import { StatusMessage } from '@/components/v2/shared/StatusMessage'
import { EntryMode, EntryModeSwitcher } from './EntryModeSwitcher'
import styles from './home.module.css'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export type AuthState = 'loading' | 'authenticated' | 'anonymous' | 'unavailable'

export type NowExperienceProps = {
  onSaveDraft: (draft: CreateEntry) => Promise<void>
  onAsk: (question: string) => void
  saveState: SaveState
  authState: AuthState
  suggestedQuestion?: string | null
  suggestionRevision?: number
}

function newEntryId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function NowExperience({ onSaveDraft, onAsk, saveState, authState, suggestedQuestion, suggestionRevision }: NowExperienceProps) {
  const [mode, setMode] = useState<EntryMode>('record')
  const [recordDraft, setRecordDraft] = useState('')
  const [askDraft, setAskDraft] = useState('')
  const [replacePending, setReplacePending] = useState<string | null>(null)
  const [localError, setLocalError] = useState('')
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const askDraftRef = useRef('')
  const draft = mode === 'record' ? recordDraft : askDraft
  const limit = mode === 'record' ? 10_000 : 500

  useEffect(() => {
    if (!replacePending) return
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.showModal()
    return () => { previous?.focus({ preventScroll: true }) }
  }, [replacePending])

  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    let frame = 0
    const move = (event: PointerEvent) => {
      if (!window.matchMedia('(pointer: fine)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.daoMotion === 'off' || document.documentElement.dataset.daoWriting === 'true') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = hero.getBoundingClientRect()
        hero.style.setProperty('--landscape-x', `${((event.clientX - box.left) / box.width - .5) * 12}px`)
        hero.style.setProperty('--landscape-y', `${((event.clientY - box.top) / box.height - .5) * 8}px`)
      })
    }
    const reset = () => { cancelAnimationFrame(frame); hero.style.setProperty('--landscape-x', '0px'); hero.style.setProperty('--landscape-y', '0px') }
    hero.addEventListener('pointermove', move)
    hero.addEventListener('pointerleave', reset)
    hero.addEventListener('focusin', reset)
    return () => { cancelAnimationFrame(frame); hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', reset); hero.removeEventListener('focusin', reset) }
  }, [])

  useEffect(() => {
    if (!suggestedQuestion) return
    setMode('ask')
    if (askDraftRef.current.trim()) setReplacePending(suggestedQuestion)
    else { askDraftRef.current = suggestedQuestion; setAskDraft(suggestedQuestion) }
  }, [suggestedQuestion, suggestionRevision])

  function chooseMode(next: EntryMode) {
    setMode(next)
    setLocalError('')
  }

  function updateDraft(value: string) {
    const next = value.slice(0, limit)
    if (mode === 'record') setRecordDraft(next)
    else { askDraftRef.current = next; setAskDraft(next) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || saveState === 'saving') return
    setLocalError('')
    if (mode === 'ask') {
      onAsk(content)
      return
    }
    if (authState !== 'authenticated') {
      setLocalError(authState === 'unavailable' ? '私人记录服务尚未配置，内容仍留在当前输入框。' : '登录后即可把这段心笺安全保存；内容仍留在当前输入框。')
      return
    }
    try {
      await onSaveDraft({ id: newEntryId(), body: content })
      setRecordDraft('')
    } catch {
      setLocalError('没有保存成功。你的文字仍在这里，可以检查连接后重试。')
    }
  }

  return <section ref={heroRef} className={styles.hero} aria-labelledby="now-title">
    <picture className={styles.heroImage}>
      <source media="(max-width: 760px)" srcSet="/_next/image?url=%2Fdaoflow-v2%2Fa02-mobile-hero.webp&w=640&q=45" />
      <Image src="/daoflow-v2/a01-hero-landscape.webp" alt="" fill priority quality={45} sizes="100vw" />
    </picture>
    <Image className={styles.distantLayer} src="/daoflow-v2/a11-distant-mountain-layer.webp" alt="" fill quality={40} sizes="100vw" />
    <Image className={styles.pineLayer} src="/daoflow-v2/a12-foreground-pine-layer.webp" alt="" fill quality={40} sizes="100vw" />
    <Image className={styles.mistLayer} src="/daoflow-v2/a13-mist-layer.webp" alt="" fill quality={40} sizes="100vw" />
    <Image className={styles.seal} src="/daoflow-v2/a10-seal-bookmark.webp" alt="" width={112} height={112} />
    <aside className={styles.inscription} aria-hidden="true"><span>一念之间 · 山水自来</span><strong>问道</strong><i>观心</i></aside>
    <div className={styles.heroContent}>
      <p className={styles.kicker}><span className={styles.sectionNumber}>壹</span> 此 刻 · 私 人 卷 册</p>
      <h1 id="now-title">此刻，什么让你挂心？</h1>
      <p className={styles.lead}>不必写得完整。先把正在心里回响的事，轻轻放在这里。</p>
      <form className={styles.editor} onSubmit={submit}>
        <EntryModeSwitcher value={mode} onChange={chooseMode} />
        <label htmlFor="now-editor">{mode === 'record' ? '写下一句此刻的心事' : '把你想问的事说清楚'}</label>
        <textarea id="now-editor" ref={editorRef} value={draft} onChange={event => updateDraft(event.target.value)} maxLength={limit} rows={5} placeholder={mode === 'record' ? '今天发生了什么？你想留住怎样的感受？' : '例如：面对这件事，我该从哪里开始看？'} />
        <div className={styles.editorFooter}>
          <span>{draft.length} / {limit}</span>
          <PrimaryButton type="submit" disabled={!draft.trim() || saveState === 'saving'}>
            {saveState === 'saving' ? <><SpinnerGap className={styles.spinner} size={18} />正在保存</> : mode === 'record' ? <>保存心笺<ArrowUpRight size={18} /></> : <>问一问道<ArrowUpRight size={18} /></>}
          </PrimaryButton>
        </div>
        {saveState === 'saved' && <StatusMessage kind="success"><CheckCircle size={17} weight="fill" /> 已落入你的卷册。</StatusMessage>}
        {localError && <StatusMessage kind="error">{localError}</StatusMessage>}
        {authState === 'anonymous' && mode === 'record' && <p className={styles.authHint}>登录后保存；未提交前这段文字只留在当前页面。</p>}
      </form>
      <div className={styles.heroFootnote}><span>把心事落在纸上，让答案慢慢生长。</span><a href="#six-realms">循境而入 <span aria-hidden="true">↓</span></a></div>
    </div>
    {replacePending && <dialog ref={dialogRef} className={styles.replaceDialog} onCancel={() => setReplacePending(null)} aria-labelledby="replace-title">
      <h2 id="replace-title">要用六境建议替换现有问题吗？</h2>
      <p>你的原有文字不会自动丢失。</p>
      <div><button type="button" onClick={() => setReplacePending(null)}>保留原文</button><PrimaryButton onClick={() => { askDraftRef.current = replacePending; setAskDraft(replacePending); setReplacePending(null); editorRef.current?.focus() }}>替换为建议</PrimaryButton></div>
    </dialog>}
  </section>
}

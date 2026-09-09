'use client'

import { createContext, MouseEvent as ReactMouseEvent, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { InkTransition } from './InkTransition'

type MotionPhase = 'idle' | 'covering' | 'navigating' | 'revealing' | 'error'

type DaoNavigation = {
  navigate: (href: string, point?: { x: number; y: number }) => void
  motionEnabled: boolean
  setMotionEnabled: (enabled: boolean) => void
}

const DaoNavigationContext = createContext<DaoNavigation | null>(null)
const COVER_MS = 340
const REVEAL_MS = 420
const SLOW_NOTICE_MS = 1_500
const FAILSAFE_MS = 5_000

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function canIntercept(event: ReactMouseEvent<HTMLAnchorElement>) {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

export function MotionProvider({ children }: PropsWithChildren) {
  const router = useRouter()
  const pathname = usePathname()
  const [phase, setPhase] = useState<MotionPhase>('idle')
  const [slow, setSlow] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const targetRef = useRef<string | null>(null)
  const timers = useRef<number[]>([])
  const position = useRef({ x: 0.5, y: 0.5 })

  const clearTimers = useCallback(() => {
    timers.current.forEach(timer => window.clearTimeout(timer))
    timers.current = []
  }, [])

  const finish = useCallback(() => {
    clearTimers()
    targetRef.current = null
    setSlow(false)
    setPhase('idle')
  }, [clearTimers])

  const navigate = useCallback((href: string, point?: { x: number; y: number }) => {
    if (!href || href === `${window.location.pathname}${window.location.search}`) return
    const resolved = new URL(href, window.location.origin)
    if (resolved.origin !== window.location.origin || resolved.hash || resolved.pathname === window.location.pathname && resolved.search === window.location.search) {
      window.location.assign(href)
      return
    }
    targetRef.current = `${resolved.pathname}${resolved.search}`
    if (point) position.current = { x: point.x / window.innerWidth, y: point.y / window.innerHeight }
    if (!enabled || reducedMotion()) {
      router.push(targetRef.current)
      return
    }
    if (phase !== 'idle') return
    clearTimers()
    setSlow(false)
    setPhase('covering')
    timers.current.push(window.setTimeout(() => {
      setPhase('navigating')
      if (targetRef.current) router.push(targetRef.current)
    }, COVER_MS))
    timers.current.push(window.setTimeout(() => setSlow(true), SLOW_NOTICE_MS))
    timers.current.push(window.setTimeout(() => {
      setPhase('error')
      setSlow(false)
    }, FAILSAFE_MS))
  }, [clearTimers, enabled, phase, router])

  useEffect(() => {
    const saved = window.localStorage.getItem('daoflow:motion')
    if (saved === 'off') setEnabled(false)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.daoMotion = enabled ? 'on' : 'off'
    window.localStorage.setItem('daoflow:motion', enabled ? 'on' : 'off')
  }, [enabled])

  useEffect(() => {
    if (phase !== 'navigating' || !targetRef.current) return
    const here = `${pathname}${window.location.search}`
    if (here !== targetRef.current) return
    clearTimers()
    setSlow(false)
    setPhase('revealing')
    timers.current.push(window.setTimeout(finish, REVEAL_MS))
  }, [clearTimers, finish, pathname, phase])

  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      const target = event.target
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)
      document.documentElement.dataset.daoWriting = editing ? 'true' : 'false'
    }
    const onBlur = () => { document.documentElement.dataset.daoWriting = 'false' }
    window.addEventListener('focusin', onFocus)
    window.addEventListener('focusout', onBlur)
    return () => { window.removeEventListener('focusin', onFocus); window.removeEventListener('focusout', onBlur); clearTimers() }
  }, [clearTimers])

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const source = event.target
      const anchor = source instanceof Element ? source.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return
      const href = new URL(anchor.href, window.location.origin)
      if (href.origin !== window.location.origin || href.hash) return
      if (`${href.pathname}${href.search}` === `${window.location.pathname}${window.location.search}`) return
      event.preventDefault()
      navigate(`${href.pathname}${href.search}`, { x: event.clientX, y: event.clientY })
    }
    document.addEventListener('click', onDocumentClick, true)
    return () => document.removeEventListener('click', onDocumentClick, true)
  }, [navigate])

  const value: DaoNavigation = { navigate, motionEnabled: enabled, setMotionEnabled: setEnabled }
  return <DaoNavigationContext.Provider value={value}>
    {children}
    <InkTransition phase={phase} slow={slow} point={position.current} onRetry={() => { const href = targetRef.current; finish(); if (href) navigate(href) }} onDismiss={finish} />
  </DaoNavigationContext.Provider>
}

export function useDaoNavigation() {
  const value = useContext(DaoNavigationContext)
  if (!value) throw new Error('useDaoNavigation must be used within MotionProvider')
  return value
}

export function DaoLink({ href, onClick, children, ...props }: React.ComponentProps<'a'>) {
  const { navigate } = useDaoNavigation()
  return <a {...props} href={href} onClick={event => {
    onClick?.(event)
    if (!canIntercept(event) || !href || props.target || props.download) return
    const link = new URL(href, window.location.origin)
    if (link.origin !== window.location.origin || link.hash) return
    event.preventDefault()
    navigate(href, { x: event.clientX, y: event.clientY })
  }}>{children}</a>
}

export function MotionToggle() {
  const { motionEnabled, setMotionEnabled } = useDaoNavigation()
  return <button type="button" className="v2-motion-toggle" aria-pressed={motionEnabled} onClick={() => setMotionEnabled(!motionEnabled)}>{motionEnabled ? '动态效果：开' : '动态效果：关'}</button>
}

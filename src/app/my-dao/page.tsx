'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ArrowRight, ArrowClockwise, CaretDown, SignOut } from '@phosphor-icons/react'
import { AUTH_SYNC_STORAGE_KEY, announceAuthChange, getAuthSession, postAuth } from '@/lib/auth/browser'
import CloudBackground from '@/components/CloudBackground'
import DaoLoading from '@/components/DaoLoading'
import { authCallbackStatusMessage, clearDaoFlowSessionStorage } from '@/lib/auth/safeNext'

interface AskSession { id: string; question: string; ai_response: string; follow_up_question: string | null; created_at: string }
export default function MyDaoPage() {
  const [user, setUser] = useState<{ id: string; email: string | null } | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState<AskSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const authenticatedUserId = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callbackMessage = authCallbackStatusMessage(params.get('auth'))
    if (callbackMessage) setError(callbackMessage)
  }, [])

  useEffect(() => {
    let active = true
    const refresh = () => {
      void getAuthSession().then(session => {
        if (!active) return
        const nextUser = session.user
        const previousUserId = authenticatedUserId.current
        if (!nextUser && previousUserId) clearDaoFlowSessionStorage(window.sessionStorage, previousUserId)
        authenticatedUserId.current = nextUser?.id ?? null
        setUser(nextUser)
      }).catch(() => { if (active) { setUser(null); setError('暂时无法连接登录服务。') } })
    }
    refresh()
    const onFocus = () => refresh()
    const onStorage = (event: StorageEvent) => { if (event.key === AUTH_SYNC_STORAGE_KEY) refresh() }
    window.addEventListener('focus', onFocus); window.addEventListener('storage', onStorage)
    return () => { active = false; window.removeEventListener('focus', onFocus); window.removeEventListener('storage', onStorage) }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    setHistoryLoading(true)
    setHistoryError('')
    fetch('/api/me/history', { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error('暂时无法读取问道记录。'); return r.json() })
      .then(data => { if (active) setSessions(data.sessions || []) })
      .catch(() => { if (active) setHistoryError('暂时无法读取问道记录，请重试。') })
      .finally(() => { clearTimeout(timeout); if (active) setHistoryLoading(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [user, attempt])

  async function signOut() {
    const signingOutUserId = authenticatedUserId.current ?? user?.id ?? null
    setSigningOut(true)
    try {
      await postAuth('/api/auth/sign-out')
      if (signingOutUserId) clearDaoFlowSessionStorage(window.sessionStorage, signingOutUserId)
      authenticatedUserId.current = null
      setUser(null); setSessions([]); setExpanded(null); announceAuthChange()
    } catch { setError('退出未成功，请再试一次。') }
    finally { setSigningOut(false) }
  }

  return <div className="relative min-h-screen"><CloudBackground />
    <main id="main-content" className="dao-account dao-container">
      <div className="dao-account-art"><Image src="/daoflow-valley.png" alt="山水静静流淌" fill sizes="40vw" /><p>走过的每一步，<br />都有自己的意义。</p></div>
      <div className="dao-account-content">
        <span className="dao-eyebrow">回望，也是前行</span><h1>我的道</h1><p>留住每一次与自己的对话。<br />再回头看时，也许已有了不同的答案。</p>
        {user === undefined && <DaoLoading />}
        {user === null && <div className="dao-error" role="status"><h2 style={{ marginTop: 18 }}>你的记录在这里等你。</h2><p>登录后即可回到私人的问道、心笺与卷册。</p><Link className="dao-primary" href="/auth/login?next=%2Fmy-dao">登录或注册<ArrowRight size={16} /></Link></div>}
        {error && <p className="dao-status" role="alert" style={{ marginTop: 20 }}>{error}</p>}
        {user && <>
          <p className="dao-status">{user.email}</p>
          {historyLoading && <DaoLoading />}
          {historyError && <div className="dao-error" role="alert"><p>{historyError}</p><button className="dao-primary" onClick={() => setAttempt(v => v + 1)}><ArrowClockwise size={16} />重新加载</button></div>}
          {!historyLoading && !historyError && sessions.length === 0 && <div className="dao-error"><h2>你的故事，从这里开始。</h2><p>还没有问道记录，写下第一个挂心的问题吧。</p><Link className="dao-primary" href="/">开始问道<ArrowUpRight size={17} /></Link></div>}
          <div className="dao-history">{sessions.map(session => <article key={session.id}>
            <button aria-expanded={expanded === session.id} onClick={() => setExpanded(expanded === session.id ? null : session.id)}><span>{session.question}<time dateTime={session.created_at}>{new Date(session.created_at).toLocaleDateString('zh-CN')}</time></span><CaretDown size={17} style={{ transform: expanded === session.id ? 'rotate(180deg)' : undefined, flexShrink: 0 }} /></button>
            {expanded === session.id && <div className="dao-history-response"><p>{session.ai_response}</p>{session.follow_up_question && <p>{session.follow_up_question}</p>}</div>}
          </article>)}</div>
          <div className="dao-reader-actions"><Link href="/journal">进入我的卷册<ArrowRight size={16} /></Link><Link href="/">再问一次<ArrowRight size={16} /></Link><button onClick={signOut} disabled={signingOut}><SignOut size={16} />{signingOut ? '正在退出' : '退出登录'}</button></div>
        </>}
      </div>
    </main>
  </div>
}

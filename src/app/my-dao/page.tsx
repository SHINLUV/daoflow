'use client'
import { FormEvent, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, ArrowRight, ArrowClockwise, EnvelopeSimple, CaretDown, SignOut } from '@phosphor-icons/react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import CloudBackground from '@/components/CloudBackground'
import DaoLoading from '@/components/DaoLoading'
import type { User } from '@supabase/supabase-js'
import { authCallbackStatusMessage, clearDaoFlowSessionStorage, safeNext } from '@/lib/auth/safeNext'

interface AskSession { id: string; question: string; ai_response: string; follow_up_question: string | null; created_at: string }
export default function MyDaoPage() {
  const [supabase] = useState(() => createClient())
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [sessions, setSessions] = useState<AskSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [signingOut, setSigningOut] = useState(false)
  const [authNext, setAuthNext] = useState('/my-dao')
  const authenticatedUserId = useRef<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const callbackMessage = authCallbackStatusMessage(params.get('auth'))
    if (callbackMessage) setError(callbackMessage)
    if (params.has('next')) setAuthNext(safeNext(params.get('next')))
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setUser(null)
      setError('登录服务尚未配置。你仍可以浏览经典；私人记录功能会在连接完成后开放。')
      return
    }
    let active = true
    const timeout = setTimeout(() => { if (active) { setUser(null); setError('登录服务连接较慢，可稍后重试。') } }, 12000)
    supabase.auth.getUser().then(({ data }) => { if (active) { authenticatedUserId.current = data.user?.id ?? null; setUser(data.user); clearTimeout(timeout) } }).catch(() => { if (active) { authenticatedUserId.current = null; setUser(null); setError('暂时无法连接登录服务。'); clearTimeout(timeout) } })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      const previousUserId = authenticatedUserId.current
      if (event === 'SIGNED_OUT' && previousUserId) clearDaoFlowSessionStorage(window.sessionStorage, previousUserId)
      authenticatedUserId.current = session?.user?.id ?? null
      setUser(session?.user ?? null)
    })
    return () => { active = false; clearTimeout(timeout); subscription.unsubscribe() }
  }, [supabase])

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

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    if (!email.trim() || sending || sent) return
    if (!isSupabaseConfigured) {
      setError('登录服务尚未配置，暂时不能发送登录链接。')
      return
    }
    setSending(true)
    setError('')
    try {
      const callback = new URL('/auth/callback', window.location.origin)
      callback.searchParams.set('next', authNext)
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callback.toString() } })
      if (error) setError('登录链接未能发送，请稍后重试。')
      else setSent(true)
    } catch { setError('连接失败，请检查网络后重试。') }
    finally { setSending(false) }
  }
  async function signOut() {
    const signingOutUserId = authenticatedUserId.current ?? user?.id ?? null
    setSigningOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      if (signingOutUserId) clearDaoFlowSessionStorage(window.sessionStorage, signingOutUserId)
      authenticatedUserId.current = null
      setUser(null); setSessions([]); setExpanded(null)
    } catch { setError('退出未成功，请再试一次。') }
    finally { setSigningOut(false) }
  }

  return <div className="relative min-h-screen"><CloudBackground />
    <main id="main-content" className="dao-account dao-container">
      <div className="dao-account-art"><Image src="/daoflow-valley.png" alt="山水静静流淌" fill sizes="40vw" /><p>走过的每一步，<br />都有自己的意义。</p></div>
      <div className="dao-account-content">
        <span className="dao-eyebrow">回望，也是前行</span><h1>我的道</h1><p>留住每一次与自己的对话。<br />再回头看时，也许已有了不同的答案。</p>
        {user === undefined && <DaoLoading />}
        {user === null && (sent ? <div className="dao-error" role="status"><EnvelopeSimple size={28} /><h2 style={{ marginTop: 18 }}>一封信，已在路上。</h2><p>请查收 {email}，点击邮件中的链接即可登录。</p><button className="dao-text-link" onClick={() => { setSent(false); setEmail('') }}>换一个邮箱<ArrowRight size={16} /></button></div> : <form className="dao-account-form" onSubmit={sendLink}>
          <label htmlFor="dao-email">邮箱地址</label>
          <input id="dao-email" type="email" autoComplete="email" required value={email} onChange={e => { setEmail(e.target.value); setError('') }} placeholder="you@example.com" disabled={sending} />
          <button className="dao-primary" type="submit" disabled={sending || !email.trim()}>{sending ? '正在发送' : '发送登录链接'}<ArrowUpRight size={17} /></button>
          <small className="dao-account-note">无需密码。通过邮件中的链接，回到你的问道记录。</small>
        </form>)}
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

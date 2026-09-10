'use client'

import { FormEvent, Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { announceAuthChange, AuthApiError, postAuth } from '@/lib/auth/browser'
import { authCallbackStatusMessage, safeNext } from '@/lib/auth/safeNext'
import { AuthNotice, AuthPageFrame } from '../_components/AuthPageFrame'

type Method = 'otp' | 'password'

function LoginContent() {
  const params = useSearchParams()
  const next = useMemo(() => safeNext(params.get('next')), [params])
  const [method, setMethod] = useState<Method>('otp')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(authCallbackStatusMessage(params.get('auth')) ?? '')
  const [error, setError] = useState(Boolean(params.get('auth')))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setMessage(''); setError(false)
    try {
      if (method === 'password') {
        await postAuth('/api/auth/password/sign-in', { email, password })
        announceAuthChange()
        window.location.assign(next)
        return
      }
      if (!otpSent) {
        await postAuth('/api/auth/otp/request', { email, redirectPath: next })
        setOtpSent(true); setMessage('验证码已经发送。若邮件中只有登录链接，也可直接打开它。')
      } else {
        await postAuth('/api/auth/otp/verify', { email, token, flow: 'login' })
        announceAuthChange()
        window.location.assign(next)
      }
    } catch (reason) {
      setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '登录暂时未完成，请稍后重试。')
    } finally { setBusy(false) }
  }

  return <AuthPageFrame title="登录 DaoFlow" intro="你的心笺、卷册和问道记录始终属于你的私人空间。">
    <div className="dao-reader-actions" role="tablist" aria-label="登录方式" style={{ margin: '24px 0 12px' }}>
      <button type="button" role="tab" aria-selected={method === 'otp'} onClick={() => { setMethod('otp'); setMessage(''); setError(false) }}>邮箱验证码</button>
      <button type="button" role="tab" aria-selected={method === 'password'} onClick={() => { setMethod('password'); setMessage(''); setError(false) }}>邮箱密码</button>
    </div>
    <form className="dao-account-form" onSubmit={submit}>
      <label htmlFor="login-email">邮箱地址</label>
      <input id="login-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
      {method === 'password' ? <>
        <label htmlFor="login-password">密码</label>
        <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      </> : otpSent && <>
        <label htmlFor="login-token">邮箱验证码</label>
        <input id="login-token" inputMode="numeric" autoComplete="one-time-code" required value={token} onChange={event => setToken(event.target.value)} disabled={busy} />
      </>}
      <button className="dao-primary" type="submit" disabled={busy}>{busy ? '正在处理' : method === 'otp' ? otpSent ? '验证并登录' : '发送验证码' : '登录'}</button>
    </form>
    {message && <AuthNotice error={error}>{message}</AuthNotice>}
    <p style={{ marginTop: 18 }}><Link href={`/auth/register?next=${encodeURIComponent(next)}`}>创建账户</Link>{' · '}<Link href={`/auth/forgot-password?next=${encodeURIComponent(next)}`}>忘记密码</Link></p>
  </AuthPageFrame>
}

export default function LoginPage() {
  return <Suspense fallback={<AuthPageFrame title="登录 DaoFlow" intro="正在准备安全登录页面。" />}><LoginContent /></Suspense>
}

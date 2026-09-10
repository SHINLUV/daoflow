'use client'

import { FormEvent, Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthApiError, postAuth } from '@/lib/auth/browser'
import { safeNext } from '@/lib/auth/safeNext'
import { AuthNotice, AuthPageFrame } from '../_components/AuthPageFrame'

function ForgotPasswordContent() {
  const params = useSearchParams()
  const next = useMemo(() => safeNext(params.get('next')), [params])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(false); setMessage('')
    try { await postAuth('/api/auth/password/recovery', { email, redirectPath: next }); setMessage('如果该邮箱可以重置密码，重置邮件已经发送。') }
    catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '暂时无法发送重置邮件。') }
    finally { setBusy(false) }
  }
  return <AuthPageFrame title="重设密码" intro="我们不会在页面上确认某个邮箱是否注册过。">
    <form className="dao-account-form" onSubmit={submit}><label htmlFor="recovery-email">邮箱地址</label><input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /><button className="dao-primary" type="submit" disabled={busy}>{busy ? '正在发送' : '发送重置邮件'}</button></form>
    {message && <AuthNotice error={error}>{message}</AuthNotice>}
    <p style={{ marginTop: 18 }}><Link href={`/auth/login?next=${encodeURIComponent(next)}`}>回到登录</Link></p>
  </AuthPageFrame>
}

export default function ForgotPasswordPage() {
  return <Suspense fallback={<AuthPageFrame title="重设密码" intro="正在准备重置页面。" />}><ForgotPasswordContent /></Suspense>
}

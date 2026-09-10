'use client'

import { FormEvent, Suspense, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AuthApiError, postAuth } from '@/lib/auth/browser'
import { safeNext } from '@/lib/auth/safeNext'
import { AuthNotice, AuthPageFrame } from '../_components/AuthPageFrame'

function RegisterContent() {
  const params = useSearchParams()
  const next = useMemo(() => safeNext(params.get('next')), [params])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setMessage(''); setError(false)
    try {
      await postAuth('/api/auth/password/sign-up', { email, password, redirectPath: next })
      setMessage('如果该邮箱可以继续注册，确认邮件已经发送。请在同一浏览器完成邮箱验证。')
    } catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '注册暂时未完成，请稍后重试。') }
    finally { setBusy(false) }
  }
  return <AuthPageFrame title="创建私人账户" intro="密码仅由认证服务处理，DaoFlow 不保存你的明文密码。">
    <form className="dao-account-form" onSubmit={submit}>
      <label htmlFor="register-email">邮箱地址</label><input id="register-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} />
      <label htmlFor="register-password">设置密码</label><input id="register-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <small className="dao-account-note">至少 12 个字符；支持密码管理器生成的长密码。</small>
      <button className="dao-primary" type="submit" disabled={busy}>{busy ? '正在提交' : '发送验证邮件'}</button>
    </form>
    {message && <AuthNotice error={error}>{message}</AuthNotice>}
    <p style={{ marginTop: 18 }}>已有账户？<Link href={`/auth/login?next=${encodeURIComponent(next)}`}>登录</Link></p>
  </AuthPageFrame>
}

export default function RegisterPage() {
  return <Suspense fallback={<AuthPageFrame title="创建私人账户" intro="正在准备注册页面。" />}><RegisterContent /></Suspense>
}

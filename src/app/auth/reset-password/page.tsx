'use client'

import { FormEvent, useState } from 'react'
import { announceAuthChange, AuthApiError, postAuth } from '@/lib/auth/browser'
import { AuthNotice, AuthPageFrame } from '../_components/AuthPageFrame'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    if (password !== confirmation) { setError(true); setMessage('两次输入的密码不一致。'); return }
    setBusy(true); setError(false); setMessage('')
    try { await postAuth('/api/auth/password/reset', { password }); announceAuthChange(); setMessage('密码已经更新。请使用新密码登录。'); setPassword(''); setConfirmation('') }
    catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '密码暂未更新，请重新验证后再试。') }
    finally { setBusy(false) }
  }
  return <AuthPageFrame title="设置新密码" intro="此操作仅接受刚从重置邮件建立的短时恢复会话。">
    <form className="dao-account-form" onSubmit={submit}>
      <label htmlFor="new-password">新密码</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      <label htmlFor="confirm-password">再次输入新密码</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
      <button className="dao-primary" type="submit" disabled={busy}>{busy ? '正在更新' : '更新密码'}</button>
    </form>
    {message && <AuthNotice error={error}>{message}</AuthNotice>}
  </AuthPageFrame>
}

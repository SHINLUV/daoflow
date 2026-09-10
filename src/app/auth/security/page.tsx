'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { announceAuthChange, AuthApiError, getAuthSession, postAuth } from '@/lib/auth/browser'
import type { AuthSessionInfo } from '@/lib/auth/contracts'
import { AuthNotice, AuthPageFrame } from '../_components/AuthPageFrame'

type Factor = { id: string; type: string; status: string; createdAt: string }
type Enrollment = { factorId: string; qrCode: string }

async function readJson<T>(response: Response): Promise<T> { return response.json() as Promise<T> }

export default function SecurityPage() {
  const [session, setSession] = useState<AuthSessionInfo | null>(null)
  const [factors, setFactors] = useState<Factor[]>([])
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null)
  const [challenge, setChallenge] = useState<{ factorId: string; challengeId: string } | null>(null)
  const [code, setCode] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState(false)

  const refresh = useCallback(async () => {
    const current = await getAuthSession(); setSession(current)
    if (!current.user) { setFactors([]); return }
    const response = await fetch('/api/auth/mfa/factors', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new AuthApiError(response.status, await response.json().catch(() => null))
    const payload = await readJson<{ factors: Factor[] }>(response); setFactors(payload.factors)
  }, [])

  useEffect(() => { refresh().catch(reason => { setError(true); setMessage(reason instanceof Error ? reason.message : '账户状态暂时不可用。') }) }, [refresh])

  async function beginEnrollment() {
    setBusy(true); setError(false); setMessage('')
    try { const response = await postAuth('/api/auth/mfa/enroll'); setEnrollment(await readJson<Enrollment>(response)); setChallenge(null); setCode(''); setMessage('请用验证器扫描二维码，再输入一次性验证码确认。') }
    catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '暂时无法启用双重验证。') }
    finally { setBusy(false) }
  }
  async function beginChallenge(factorId: string) {
    setBusy(true); setError(false); setMessage('')
    try { const response = await postAuth('/api/auth/mfa/challenge', { factorId }); setChallenge(await readJson<{ factorId: string; challengeId: string }>(response)); setCode(''); setMessage('请输入验证器中的一次性验证码。') }
    catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '暂时无法开始验证。') }
    finally { setBusy(false) }
  }
  async function verify(event: FormEvent) {
    event.preventDefault(); if (!challenge || busy) return
    setBusy(true); setError(false); setMessage('')
    try { await postAuth('/api/auth/mfa/verify', { ...challenge, code }); setEnrollment(null); setChallenge(null); setCode(''); await refresh(); setMessage('双重验证已完成；高风险操作在 15 分钟内可继续进行。') }
    catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '双重验证未完成。') }
    finally { setBusy(false) }
  }
  async function unenroll(factorId: string) {
    setBusy(true); setError(false); setMessage('')
    try { await postAuth('/api/auth/mfa/unenroll', { factorId }); await refresh(); setMessage('验证器已移除。') }
    catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '暂时无法移除验证器。') }
    finally { setBusy(false) }
  }
  async function signOut(all: boolean) {
    setBusy(true); setError(false); setMessage('')
    try { await postAuth(all ? '/api/auth/sign-out-all' : '/api/auth/sign-out'); announceAuthChange(); window.location.assign('/auth/login') }
    catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '退出暂时未完成。') }
    finally { setBusy(false) }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true); setError(false); setMessage('')
    try { await postAuth('/api/auth/password/change', { currentPassword, newPassword }); setCurrentPassword(''); setNewPassword(''); setMessage('密码已经更新。') }
    catch (reason) { setError(true); setMessage(reason instanceof AuthApiError ? reason.message : '密码暂未更新。') }
    finally { setBusy(false) }
  }

  if (!session?.user) return <AuthPageFrame title="账户安全" intro="请先登录后管理密码与双重验证。"><p><Link className="dao-primary" href="/auth/login?next=%2Fauth%2Fsecurity">前往登录</Link></p>{message && <AuthNotice error={error}>{message}</AuthNotice>}</AuthPageFrame>

  const activeFactor = enrollment?.factorId ?? challenge?.factorId ?? factors[0]?.id
  return <AuthPageFrame title="账户安全" intro={`当前账户：${session.user.email ?? '已验证账户'}；会话保障等级：${session.aal.toUpperCase()}。`}>
    <section aria-labelledby="password-heading" style={{ marginTop: 24 }}>
      <h2 id="password-heading">修改密码</h2>
      <form className="dao-account-form" onSubmit={changePassword}>
        <label htmlFor="current-password">当前密码</label><input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} disabled={busy} />
        <label htmlFor="security-new-password">新密码</label><input id="security-new-password" type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={busy} />
        <button className="dao-primary" type="submit" disabled={busy}>更新密码</button>
      </form>
    </section>
    <section aria-labelledby="mfa-heading" style={{ marginTop: 24 }}>
      <h2 id="mfa-heading">双重验证</h2>
      <p>启用 TOTP 后，审核等敏感权限还会要求 AAL2 和近期验证。</p>
      {factors.length === 0 && !enrollment && <button className="dao-primary" type="button" onClick={beginEnrollment} disabled={busy}>启用验证器</button>}
      {enrollment && <div className="dao-error" style={{ marginTop: 16 }}>
        <p>仅在你的设备上扫描此二维码；不要截图或转发。</p>
        {/* The enrollment secret is a short-lived data URI and must not be sent to an image optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={enrollment.qrCode} alt="DaoFlow 双重验证二维码" width={220} height={220} />
      </div>}
      {factors.length > 0 && <ul>{factors.map(factor => <li key={factor.id} style={{ marginTop: 12 }}><span>{factor.type}（{factor.status}）</span>{session.aal !== 'aal2' && <button type="button" className="dao-text-link" onClick={() => beginChallenge(factor.id)} disabled={busy}>验证</button>}<button type="button" className="dao-text-link" onClick={() => unenroll(factor.id)} disabled={busy}>移除</button></li>)}</ul>}
      {activeFactor && (enrollment || challenge) && <form className="dao-account-form" onSubmit={verify} style={{ marginTop: 16 }}><label htmlFor="mfa-code">一次性验证码</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} required disabled={busy} /><button className="dao-primary" type="submit" disabled={busy}>确认验证器</button></form>}
    </section>
    <section aria-labelledby="sessions-heading" style={{ marginTop: 32 }}><h2 id="sessions-heading">会话</h2><div className="dao-reader-actions"><button type="button" onClick={() => signOut(false)} disabled={busy}>退出当前会话</button><button type="button" onClick={() => signOut(true)} disabled={busy}>退出所有会话</button></div></section>
    {message && <AuthNotice error={error}>{message}</AuthNotice>}
  </AuthPageFrame>
}

import Link from 'next/link'
import type { ReactNode } from 'react'

export function AuthPageFrame({ title, intro, children }: { title: string; intro: string; children?: ReactNode }) {
  return <main id="main-content" className="dao-container dao-account" style={{ paddingTop: 112, paddingBottom: 64, maxWidth: 720 }}>
    <section className="dao-account-content" style={{ maxWidth: 560, margin: '0 auto' }}>
      <p className="dao-eyebrow">DaoFlow 私人账户</p>
      <h1>{title}</h1>
      <p>{intro}</p>
      {children}
      <p style={{ marginTop: 24 }}><Link className="dao-text-link" href="/">回到此刻</Link></p>
    </section>
  </main>
}

export function AuthNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <p role={error ? 'alert' : 'status'} className="dao-status" style={{ marginTop: 16 }}>{children}</p>
}

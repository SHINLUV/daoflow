'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight } from '@phosphor-icons/react'
import { MotionToggle } from '@/components/v2/motion/MotionProvider'

export default function NavBar() {
  const pathname = usePathname()
  const home = pathname === '/'
  const journal = pathname.startsWith('/journal') || pathname === '/my-dao'
  const reading = pathname.startsWith('/chapters')
  return <>
    <a className="v2-skip" href="#main-content">跳到主要内容</a>
    <header className="v2-header">
      <nav className="v2-nav" aria-label="主导航">
        <Link href="/" className="v2-brand" aria-label="DaoFlow 此刻首页"><span aria-hidden="true">道</span><b>DaoFlow</b></Link>
        <div className="v2-nav-links">
          <Link href="/" aria-current={home ? 'page' : undefined}>此刻</Link>
          <Link href="/journal" aria-current={journal ? 'page' : undefined}>我的卷册</Link>
          <Link href="/chapters" aria-current={reading ? 'page' : undefined}>读经典</Link>
        </div>
        <div className="v2-account-actions"><MotionToggle /><Link href="/my-dao" className="v2-account" aria-label="登录或查看我的道"><span>我的道</span><ArrowUpRight size={16} /></Link></div>
      </nav>
    </header>
  </>
}

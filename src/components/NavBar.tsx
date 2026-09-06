'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowUpRight, YinYang } from '@phosphor-icons/react'

export default function NavBar() {
  const pathname = usePathname()
  const [hash, setHash] = useState('')
  useEffect(() => {
    const sync = () => setHash(window.location.hash)
    sync()
    window.addEventListener('hashchange', sync)
    window.addEventListener('popstate', sync)
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync) }
  }, [pathname])
  const home = pathname === '/' && !hash
  const themes = pathname === '/' && hash === '#themes'
  const about = pathname === '/' && hash === '#about'
  const reading = pathname.startsWith('/chapters')
  return <>
    <a className="dao-skip" href="#main-content">跳到主要内容</a>
    <header className="dao-header">
      <nav className="dao-nav dao-container" aria-label="主导航">
        <Link href="/" onClick={() => setHash('')} className="dao-brand" aria-label="DaoFlow 问道首页"><YinYang size={33} weight="fill" /><span>DaoFlow<small>问 道</small></span></Link>
        <div className="dao-nav-links">
          <Link href="/" onClick={() => setHash('')} className={home ? 'is-active' : ''} aria-current={home ? 'page' : undefined}>问道</Link>
          <Link href="/#themes" onClick={() => setHash('#themes')} className={themes ? 'is-active' : ''} aria-current={themes ? 'location' : undefined}>人生主题</Link>
          <Link href="/chapters/1" className={reading ? 'is-active' : ''} aria-current={reading ? 'page' : undefined}>读经典</Link>
          <Link href="/#about" onClick={() => setHash('#about')} className={about ? 'is-active' : ''} aria-current={about ? 'location' : undefined}>关于</Link>
        </div>
        <Link href="/my-dao" aria-current={pathname === '/my-dao' ? 'page' : undefined} className={`dao-my-link ${pathname === '/my-dao' ? 'is-active' : ''}`}>我的道<ArrowUpRight size={16} /></Link>
      </nav>
    </header>
  </>
}

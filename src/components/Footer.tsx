import Link from 'next/link'
export default function Footer() {
  return <footer className="dao-footer"><div className="dao-container"><Link href="/" className="dao-footer-brand">DaoFlow<span>问道</span></Link><p>道法自然，生活亦然。</p><Link href="/#about">关于 DaoFlow</Link></div></footer>
}

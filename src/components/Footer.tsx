import Link from 'next/link'
export default function Footer() {
  return <footer className="v2-footer"><div><Link href="/" className="v2-footer-brand">DaoFlow <span>问道</span></Link><p>记下此刻，慢慢回看自己的来处。</p><Link href="/#about">关于 DaoFlow</Link></div></footer>
}

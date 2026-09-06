import Link from 'next/link'
import NavBar from '@/components/NavBar'
import CloudBackground from '@/components/CloudBackground'
export default function NotFound() {
  return <div className="relative min-h-screen"><CloudBackground /><NavBar /><main id="main-content" className="dao-reader"><span className="dao-eyebrow">404 · 页面不存在</span><h1>此处无路，回到来处。</h1><div className="dao-error"><p>这个页面可能已移走，或链接有误。回到问道，继续你的探索。</p><Link href="/" className="dao-primary">返回问道</Link></div></main></div>
}

import type { Metadata } from 'next'
import { MineClient } from './MineClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: '我的分享 · DaoFlow', robots: { index: false, follow: false } }

export default function MinePage() {
  return <MineClient />
}

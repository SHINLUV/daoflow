import type { Metadata } from 'next'
import { PublishClient } from './PublishClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: '匿名分享 · DaoFlow', robots: { index: false, follow: false } }

export default function PublishPage() {
  return <PublishClient />
}

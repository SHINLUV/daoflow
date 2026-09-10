import type { Metadata } from 'next'
import { HallClient } from './HallClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: '同道大厅 · DaoFlow', robots: { index: false, follow: false } }

export default function HallPage() {
  return <HallClient />
}

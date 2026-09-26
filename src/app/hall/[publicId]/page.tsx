import type { Metadata } from 'next'
import { HallDetailClient } from './HallDetailClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata: Metadata = { title: '同道分享 · DaoFlow', robots: { index: false, follow: false } }

export default async function HallDetailPage(props: { params: Promise<{ publicId: string }> }) {
  const params = await props.params;
  return <HallDetailClient publicId={params.publicId} />
}

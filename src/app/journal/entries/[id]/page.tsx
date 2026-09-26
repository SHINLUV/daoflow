import { JournalEditor } from '@/components/v2/journal/JournalEditor'
import { Suspense } from 'react'

export default async function JournalEntryPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <Suspense fallback={<main /> }><JournalEditor entryId={params.id} /></Suspense>
}

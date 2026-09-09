import { JournalEditor } from '@/components/v2/journal/JournalEditor'
import { Suspense } from 'react'

export default function JournalEntryPage({ params }: { params: { id: string } }) {
  return <Suspense fallback={<main /> }><JournalEditor entryId={params.id} /></Suspense>
}

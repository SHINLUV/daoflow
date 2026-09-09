import { JournalLibrary } from '@/components/v2/journal/JournalLibrary'
import { Suspense } from 'react'

export default function JournalPage() {
  return <Suspense fallback={<main /> }><JournalLibrary /></Suspense>
}

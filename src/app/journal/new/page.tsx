import { JournalEditor } from '@/components/v2/journal/JournalEditor'
import { Suspense } from 'react'

export default function NewJournalEntryPage(){return <Suspense fallback={<main/>}><JournalEditor/></Suspense>}

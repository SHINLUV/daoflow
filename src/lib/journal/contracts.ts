export type Mood = 'calm' | 'uneasy' | 'sad' | 'angry' | 'hopeful' | 'mixed'

export type Entry = {
  id: string
  title: string | null
  body: string
  mood: Mood | null
  volumeId: string | null
  version: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type Page<T> = { items: T[]; nextCursor: string | null }

export type CreateEntry = {
  id: string
  body: string
  title?: string
  mood?: Mood | null
  volumeId?: string | null
}

export type PatchEntry = {
  version: number
  body?: string
  title?: string | null
  mood?: Mood | null
  volumeId?: string | null
  deleted?: boolean
}

export type Volume = {
  id: string
  title: string
  archivedAt: string | null
  version: number
  entryCount: number
  createdAt: string
  updatedAt: string
}

export type Favorite = {
  id: string
  chapterId: number
  excerpt: string
  note: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export type TimelineItem =
  | { type: 'entry'; createdAt: string; id: string; entry: Entry }
  | { type: 'ask'; createdAt: string; id: string; question: string; response: string; sourceEntryId: string | null; volumeId: string | null }

export type ApiError = {
  error: { code: string; message: string }
  requestId: string
}

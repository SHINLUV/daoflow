export type CorpusReviewStatus = 'pending' | 'approved' | 'rejected'
export type CorpusEligibility = 'eligible' | 'not_eligible' | 'configuration_error'

export interface CorpusRuntimePolicy {
  eligibility: CorpusEligibility
  corpusVersion: string | null
  reason: string
}

export interface RetrievalEvidence {
  chunkId: string
  chapter: number
  paragraph: number | null
  text: string
  edition: string
  kind: 'original' | 'translation' | 'annotation'
  reviewStatus: 'approved'
  corpusVersion: string
  sourceRevision: string
  sourceUrl: string
  license: string
  score?: number
}

/** The repository adapter must be backed by the protected corpus tables only. */
export interface CorpusChunkRecord {
  chunkId: string
  chapter: number
  paragraph: number | null
  text: string
  edition: string
  kind: 'original' | 'translation' | 'annotation'
  reviewStatus: CorpusReviewStatus
  corpusVersion: string
  sourceRevision: string
  sourceUrl: string
  license: string
  themeTerms: string[]
}

export interface ApprovedCorpusRepository {
  getRuntimePolicy(): Promise<CorpusRuntimePolicy>
  listChunksForLexicalRetrieval(corpusVersion: string): Promise<CorpusChunkRecord[]>
}

export type RetrievalResult =
  | { kind: 'evidence'; corpusVersion: string; evidence: RetrievalEvidence[] }
  | { kind: 'insufficient_evidence'; corpusVersion: string | null; reason: 'CORPUS_NOT_ELIGIBLE' | 'NO_APPROVED_EVIDENCE' }
  | { kind: 'configuration_error'; corpusVersion: string | null; reason: string }

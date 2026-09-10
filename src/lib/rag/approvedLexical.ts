import type { ApprovedCorpusRepository, CorpusChunkRecord, RetrievalEvidence, RetrievalResult } from './types'

/**
 * The repository starts in this fail-closed state. A migration/RPC-backed
 * adapter may return eligible only after the version and every selected chunk
 * have independent approval. Seed JSON is intentionally never a fallback.
 */
export const NOT_ELIGIBLE_CORPUS_POLICY = {
  eligibility: 'not_eligible' as const,
  corpusVersion: null,
  reason: 'CORPUS_MANIFEST_NOT_INDEPENDENTLY_APPROVED',
}

export async function retrieveApprovedLexically(
  question: string,
  repository: ApprovedCorpusRepository,
  limit = 5,
): Promise<RetrievalResult> {
  const policy = await repository.getRuntimePolicy()
  if (policy.eligibility === 'configuration_error') {
    return { kind: 'configuration_error', corpusVersion: policy.corpusVersion, reason: policy.reason }
  }
  if (policy.eligibility !== 'eligible' || !policy.corpusVersion) {
    return { kind: 'insufficient_evidence', corpusVersion: policy.corpusVersion, reason: 'CORPUS_NOT_ELIGIBLE' }
  }

  const tokens = lexicalTokens(question)
  if (tokens.length === 0) {
    return { kind: 'insufficient_evidence', corpusVersion: policy.corpusVersion, reason: 'NO_APPROVED_EVIDENCE' }
  }
  const chunks = await repository.listChunksForLexicalRetrieval(policy.corpusVersion)
  const ranked = chunks
    .filter(chunk => chunk.reviewStatus === 'approved' && chunk.corpusVersion === policy.corpusVersion)
    .map(chunk => ({ chunk, score: lexicalScore(tokens, chunk) }))
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.chunk.chapter - right.chunk.chapter || left.chunk.chunkId.localeCompare(right.chunk.chunkId))

  const selected = diversitySelect(ranked, Math.min(Math.max(limit, 1), 5))
  if (selected.length === 0) {
    return { kind: 'insufficient_evidence', corpusVersion: policy.corpusVersion, reason: 'NO_APPROVED_EVIDENCE' }
  }
  return {
    kind: 'evidence',
    corpusVersion: policy.corpusVersion,
    evidence: selected.map(({ chunk, score }) => toEvidence(chunk, score)),
  }
}

export function lexicalTokens(input: string): string[] {
  const normalized = input.normalize('NFC').trim().toLowerCase()
  const terms = new Set<string>()
  // Use the CJK Unified Ideographs range rather than Unicode property escapes:
  // the repository's standalone `tsc` invocation does not set a modern target.
  for (const word of normalized.match(/[\u3400-\u9fff]{2,}|[a-z0-9]{2,}/g) ?? []) {
    terms.add(word)
    if (/^[\u3400-\u9fff]+$/.test(word)) {
      for (let index = 0; index < word.length - 1; index += 1) terms.add(word.slice(index, index + 2))
    }
  }
  return Array.from(terms)
}

export function lexicalScore(tokens: string[], chunk: CorpusChunkRecord): number {
  const haystack = `${chunk.text}\n${chunk.themeTerms.join(' ')}`.normalize('NFC').toLowerCase()
  let score = 0
  for (const token of tokens) {
    if (haystack.includes(token)) score += token.length >= 3 ? 3 : 1
  }
  return score
}

function diversitySelect<T extends { chunk: CorpusChunkRecord }>(ranked: Array<T & { score: number }>, limit: number): Array<T & { score: number }> {
  const chapters = new Set<number>()
  const selected: Array<T & { score: number }> = []
  for (const candidate of ranked) {
    if (chapters.has(candidate.chunk.chapter) && selected.length < Math.min(3, limit)) continue
    selected.push(candidate)
    chapters.add(candidate.chunk.chapter)
    if (selected.length === limit) break
  }
  return selected
}

function toEvidence(chunk: CorpusChunkRecord, score: number): RetrievalEvidence {
  if (chunk.reviewStatus !== 'approved') throw new Error('Only approved corpus chunks may become evidence')
  return {
    chunkId: chunk.chunkId,
    chapter: chunk.chapter,
    paragraph: chunk.paragraph,
    text: chunk.text,
    edition: chunk.edition,
    kind: chunk.kind,
    reviewStatus: 'approved',
    corpusVersion: chunk.corpusVersion,
    sourceRevision: chunk.sourceRevision,
    sourceUrl: chunk.sourceUrl,
    license: chunk.license,
    score,
  }
}

import { describe, expect, it, vi } from 'vitest'
import { retrieveApprovedLexically } from '../approvedLexical'
import type { ApprovedCorpusRepository, CorpusChunkRecord } from '../types'

const chunks: CorpusChunkRecord[] = [
  { chunkId: 'approved-8', chapter: 8, paragraph: null, text: '上善若水。水善利万物而不争。', edition: '王弼本', kind: 'original', reviewStatus: 'approved', corpusVersion: 'wb-v1', sourceRevision: '1', sourceUrl: 'https://example.invalid', license: 'CC BY-SA 4.0', themeTerms: ['关系 边界 柔和'] },
  { chunkId: 'pending-44', chapter: 44, paragraph: null, text: '名与身孰亲？身与货孰多？', edition: '未审稿', kind: 'original', reviewStatus: 'pending', corpusVersion: 'wb-v1', sourceRevision: '1', sourceUrl: 'https://example.invalid', license: 'unknown', themeTerms: ['选择 焦虑'] },
]

function repo(eligibility: 'eligible' | 'not_eligible'): ApprovedCorpusRepository {
  return {
    getRuntimePolicy: vi.fn().mockResolvedValue({ eligibility, corpusVersion: eligibility === 'eligible' ? 'wb-v1' : null, reason: 'test' }),
    listChunksForLexicalRetrieval: vi.fn().mockResolvedValue(chunks),
  }
}

describe('approved lexical retrieval', () => {
  it('fails closed when the manifest is not eligible and never reads chunks', async () => {
    const repository = repo('not_eligible')
    await expect(retrieveApprovedLexically('关系边界怎么说', repository)).resolves.toMatchObject({ kind: 'insufficient_evidence', reason: 'CORPUS_NOT_ELIGIBLE' })
    expect(repository.listChunksForLexicalRetrieval).not.toHaveBeenCalled()
  })

  it('returns only approved chunks and never promotes pending text into evidence', async () => {
    const result = await retrieveApprovedLexically('关系边界如何柔和表达', repo('eligible'))
    expect(result).toMatchObject({ kind: 'evidence', corpusVersion: 'wb-v1' })
    if (result.kind === 'evidence') expect(result.evidence.map(item => item.chunkId)).toEqual(['approved-8'])
  })
})

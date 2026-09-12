import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

type CandidateManifest = {
  status: string
  retrievalEligibility: string
  source: { revisionId: string; rawUtf8Sha256: string; license: string }
  review: { approvalState: string; approvedBy: string | null; approvedAt: string | null }
  chapterComparisons: Array<{
    chapter: number
    sourceVerseNormalizedSha256: string
    localBaselineNormalizedSha256: string
    review: string
  }>
}

function candidateManifest(): CandidateManifest {
  const path = resolve(process.cwd(), 'docs/redesign-v2/corpus/dao-de-jing-wang-bi-v1.manifest.json')
  return JSON.parse(readFileSync(path, 'utf8')) as CandidateManifest
}

describe('Wang Bi corpus candidate manifest', () => {
  it('keeps the unreviewed candidate ineligible with a fixed source revision and 81 distinct chapter records', () => {
    const manifest = candidateManifest()
    expect(manifest.status).toBe('PENDING_INDEPENDENT_CONTENT_REVIEW')
    expect(manifest.retrievalEligibility).toBe('NOT_ELIGIBLE')
    expect(manifest.review).toMatchObject({
      approvalState: 'PENDING',
      approvedBy: null,
      approvedAt: null,
    })
    expect(manifest.source.revisionId).toMatch(/^\d+$/)
    expect(manifest.source.rawUtf8Sha256).toMatch(/^[A-F0-9]{64}$/)
    expect(manifest.source.license).toContain('pending_license_page_capture')
    expect(manifest.chapterComparisons).toHaveLength(81)
    expect(manifest.chapterComparisons.map(item => item.chapter).sort((a, b) => a - b)).toEqual([...Array(81)].map((_, index) => index + 1))
    expect(manifest.chapterComparisons.every(item => (
      /^[A-F0-9]{64}$/.test(item.sourceVerseNormalizedSha256)
      && /^[A-F0-9]{64}$/.test(item.localBaselineNormalizedSha256)
      && item.review === 'pending_independent_content_review'
    ))).toBe(true)
  })
})

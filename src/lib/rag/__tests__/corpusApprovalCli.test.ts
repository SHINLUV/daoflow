import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex').toUpperCase()

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('independent corpus approval CLI', () => {
  it('binds approval to the exact pending release and exact approving report', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-corpus-approval-'))
    temporaryDirectories.push(directory)
    const input = join(directory, 'pending.json')
    const output = join(directory, 'approved.json')
    const report = join(directory, 'review.md')
    const pending = JSON.stringify({
      status: 'pending_independent_content_review',
      chunks: [{ chunkId: 'one', chapter: 1, reviewStatus: 'pending' }, { chunkId: 'two', chapter: 2, reviewStatus: 'pending' }],
    }, null, 2) + '\n'
    const review = '# Review\n\nFINAL_DECISION: APPROVED\n'
    writeFileSync(input, pending, 'utf8')
    writeFileSync(report, review, 'utf8')
    const run = spawnSync(process.execPath, [
      resolve(process.cwd(), 'scripts/corpus/approve-corpus-release.mjs'),
      '--input', input,
      '--output', output,
      '--expected-release-sha256', digest(pending),
      '--review-report', report,
      '--expected-review-sha256', digest(review),
      '--reviewer', 'independent-reviewer',
      '--reviewed-at', '2026-09-15T05:00:00.000Z',
      '--expected-chapters', '2',
    ], { encoding: 'utf8' })
    expect(run.status, run.stderr).toBe(0)
    const approved = JSON.parse(readFileSync(output, 'utf8'))
    expect(approved.status).toBe('approved')
    expect(approved.review).toMatchObject({
      approvedBy: 'independent-reviewer',
      approvedAt: '2026-09-15T05:00:00.000Z',
      preApprovalReleaseSha256: digest(pending),
      reviewReportSha256: digest(review),
    })
    expect(approved.chunks.map((chunk: { reviewStatus: string }) => chunk.reviewStatus)).toEqual(['approved', 'approved'])
  })

  it('refuses a report that does not explicitly approve', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-corpus-approval-'))
    temporaryDirectories.push(directory)
    const input = join(directory, 'pending.json')
    const report = join(directory, 'review.md')
    const pending = '{"status":"pending_independent_content_review","chunks":[]}\n'
    const review = 'FINAL_DECISION: NEEDS_REMEDIATION\n'
    writeFileSync(input, pending, 'utf8')
    writeFileSync(report, review, 'utf8')
    const run = spawnSync(process.execPath, [
      resolve(process.cwd(), 'scripts/corpus/approve-corpus-release.mjs'),
      '--input', input,
      '--output', join(directory, 'approved.json'),
      '--expected-release-sha256', digest(pending),
      '--review-report', report,
      '--expected-review-sha256', digest(review),
      '--reviewer', 'independent-reviewer',
      '--reviewed-at', '2026-09-15T05:00:00.000Z',
      '--expected-chapters', '1',
    ], { encoding: 'utf8' })
    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('REVIEW_NOT_APPROVED')
  })
})

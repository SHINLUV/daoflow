import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('approved corpus migration renderer', () => {
  it('renders an idempotent, forward-only migration for independently approved chunks', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-corpus-sql-'))
    temporaryDirectories.push(directory)
    const input = join(directory, 'release.json')
    const output = join(directory, 'migration.sql')
    const firstContent = "道可道，it's fixed。"
    const secondContent = '天下皆知美。'
    const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex').toUpperCase()
    writeFileSync(input, JSON.stringify({
      corpusVersion: 'dao-de-jing-wang-bi-v1',
      edition: '道德經（王弼本）',
      status: 'approved',
      source: {
        revisionId: '2354026', revisionUrl: 'https://example.test/revision', rawUtf8Sha256: 'A'.repeat(64),
        license: 'Public-Domain; CC-BY-SA-4.0', attribution: "Wikisource's fixed revision",
      },
      review: { approvedBy: 'independent-reviewer', approvedAt: '2026-09-15T04:30:00.000Z' },
      chunks: [
        { chunkId: 'wb-01', chapter: 1, paragraph: null, kind: 'original', content: firstContent, contentSha256: digest(firstContent), edition: '道德經（王弼本）', sourceRevision: '2354026', sourceUrl: 'https://example.test/revision', license: 'Public-Domain; CC-BY-SA-4.0', themeTerms: ['成长', '选择'], reviewStatus: 'approved' },
        { chunkId: 'wb-02', chapter: 2, paragraph: null, kind: 'original', content: secondContent, contentSha256: digest(secondContent), edition: '道德經（王弼本）', sourceRevision: '2354026', sourceUrl: 'https://example.test/revision', license: 'Public-Domain; CC-BY-SA-4.0', themeTerms: [], reviewStatus: 'approved' },
      ],
    }), 'utf8')

    const run = spawnSync(process.execPath, [
      resolve(process.cwd(), 'scripts/corpus/render-corpus-migration.mjs'),
      '--input', input,
      '--output', output,
      '--manifest-path', 'docs/redesign-v2/corpus/release.json',
      '--expected-chapters', '2',
    ], { encoding: 'utf8' })

    expect(run.status, run.stderr).toBe(0)
    const sql = readFileSync(output, 'utf8')
    expect(sql).not.toMatch(/^(begin|commit);$/im)
    expect(sql).toContain("'approved'")
    expect(sql).toContain("'independent-reviewer'")
    expect(sql).toContain("it''s fixed")
    expect(sql).toContain("array['成长', '选择']::text[]")
    expect(sql.match(/wang-bi-2354026-document/g)?.length).toBeGreaterThanOrEqual(1)
    expect(sql).toContain('on conflict (chunk_id) do update')
    expect(sql).toContain('CORPUS_POSTCONDITION_FAILED')
    expect(sql).not.toMatch(/\b(delete|truncate|drop)\b/i)
  })

  it('refuses a pending or internally inconsistent release', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-corpus-sql-'))
    temporaryDirectories.push(directory)
    const input = join(directory, 'release.json')
    writeFileSync(input, JSON.stringify({ status: 'pending_independent_content_review', chunks: [] }), 'utf8')
    const run = spawnSync(process.execPath, [
      resolve(process.cwd(), 'scripts/corpus/render-corpus-migration.mjs'),
      '--input', input,
      '--output', join(directory, 'migration.sql'),
      '--manifest-path', 'release.json',
      '--expected-chapters', '2',
    ], { encoding: 'utf8' })
    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('CORPUS_NOT_APPROVED')
  })
})

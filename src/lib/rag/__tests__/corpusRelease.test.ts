import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, describe, expect, it } from 'vitest'

const root = process.cwd()
const releasePath = resolve(root, 'docs/redesign-v2/corpus/dao-de-jing-wang-bi-v1.release.json')
const sourcePath = resolve(root, 'docs/redesign-v2/corpus/sources/dao-de-jing-wang-bi-2354026.wiki')
const verificationPath = resolve(root, 'docs/redesign-v2/corpus/sources/wang-bi-saoye-1925.pdf')
const release = JSON.parse(readFileSync(releasePath, 'utf8'))
const temporaryDirectories: string[] = []

afterAll(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true })
})

describe('Wang Bi trusted corpus release artifact', () => {
  it('is pinned to the reviewed 81-chapter Wikisource revision with exact hashes', () => {
    const source = readFileSync(sourcePath)
    expect(release).toMatchObject({
      schemaVersion: 1,
      corpusVersion: 'dao-de-jing-wang-bi-v1',
      edition: '道德經（王弼本·維基文庫固定版本2354026）',
      source: {
        revisionId: '2354026',
        revisionUrl: 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026',
        rawUtf8Sha256: '4827E5A84B37FDEAA99706B7505B3719B5EB40E2DA8E7B8A0A499944051AF611',
        license: 'CC-BY-SA-4.0',
      },
    })
    expect(createHash('sha256').update(source).digest('hex').toUpperCase()).toBe(release.source.rawUtf8Sha256)
    expect(release.verificationSources).toHaveLength(1)
    expect(createHash('sha256').update(readFileSync(verificationPath)).digest('hex').toUpperCase())
      .toBe(release.verificationSources[0].fileSha256)
    expect(release.chunks).toHaveLength(81)
    expect(release.chunks.map((chunk: { chapter: number }) => chunk.chapter)).toEqual(Array.from({ length: 81 }, (_, index) => index + 1))
    expect(new Set(release.chunks.map((chunk: { chunkId: string }) => chunk.chunkId)).size).toBe(81)
    for (const chunk of release.chunks) {
      expect(chunk.kind).toBe('original')
      expect(chunk.content.trim().length).toBeGreaterThan(0)
      expect(createHash('sha256').update(chunk.content, 'utf8').digest('hex').toUpperCase()).toBe(chunk.contentSha256)
      expect(chunk.sourceRevision).toBe(release.source.revisionId)
      expect(chunk.sourceUrl).toBe(release.source.revisionUrl)
      expect(chunk.license).toBe(release.source.license)
      expect(chunk.themeTerms.length).toBeGreaterThanOrEqual(4)
      expect(chunk.themeTerms.length).toBeLessThanOrEqual(6)
    }
    const termFrequency = new Map<string, number>()
    for (const chunk of release.chunks) {
      for (const term of chunk.themeTerms) termFrequency.set(term, (termFrequency.get(term) ?? 0) + 1)
    }
    expect(Math.max(...termFrequency.values())).toBeLessThanOrEqual(8)
    expect(Array.from(termFrequency.keys())).not.toEqual(expect.arrayContaining(['成长与自我', '无为与有为', '事业与创业']))
    expect(JSON.stringify(release)).not.toContain('可道之道，可名之名，指事造形')
    expect(JSON.stringify(release)).not.toContain('{{*|')
  })

  it('rebuilds deterministically from the committed source and metadata', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-release-rebuild-'))
    temporaryDirectories.push(directory)
    const rebuiltPath = join(directory, 'release.json')
    const run = spawnSync(process.execPath, [
      resolve(root, 'scripts/corpus/build-wang-bi-corpus.mjs'),
      '--input', sourcePath,
      '--metadata', resolve(root, 'scripts/corpus/wang-bi-retrieval-index.json'),
      '--output', rebuiltPath,
      '--expected-sha256', release.source.rawUtf8Sha256,
      '--expected-chapters', '81',
    ], { encoding: 'utf8' })
    expect(run.status, run.stderr).toBe(0)
    const rebuilt = JSON.parse(readFileSync(rebuiltPath, 'utf8'))
    expect(rebuilt.source).toEqual(release.source)
    expect(rebuilt.chunks).toEqual(release.chunks.map((chunk: Record<string, unknown>) => ({
      ...chunk,
      reviewStatus: 'pending',
    })))
  })
})

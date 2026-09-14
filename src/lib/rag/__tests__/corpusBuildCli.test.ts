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

describe('Wikisource Wang Bi corpus builder', () => {
  it('extracts only chapter verses from a hash-pinned source', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-corpus-'))
    temporaryDirectories.push(directory)
    const input = join(directory, 'source.wiki')
    const output = join(directory, 'corpus.json')
    const source = [
      '==一章==',
      '道可道，非常道。',
      ':{{*|這是王弼注，不得進入原文 chunk。}}',
      '==二章==',
      '天下皆知美之為美，斯惡已。',
      '-{谷}-神不死。',
      ':{{*|另一條注釋。}}',
    ].join('\n')
    writeFileSync(input, source, 'utf8')
    const sha256 = createHash('sha256').update(Buffer.from(source, 'utf8')).digest('hex').toUpperCase()

    const run = spawnSync(process.execPath, [
      resolve(process.cwd(), 'scripts/corpus/build-wang-bi-corpus.mjs'),
      '--input', input,
      '--output', output,
      '--expected-sha256', sha256,
      '--expected-chapters', '2',
    ], { encoding: 'utf8' })

    expect(run.status, run.stderr).toBe(0)
    const built = JSON.parse(readFileSync(output, 'utf8'))
    expect(built.source.rawUtf8Sha256).toBe(sha256)
    expect(built.chunks).toMatchObject([
      { chapter: 1, content: '道可道，非常道。', reviewStatus: 'pending' },
      { chapter: 2, content: '天下皆知美之為美，斯惡已。\n谷神不死。', reviewStatus: 'pending' },
    ])
    expect(built.chunks.map((chunk: { content: string }) => chunk.content).join('\n')).not.toContain('王弼注')
    expect(built.chunks.map((chunk: { content: string }) => chunk.content).join('\n')).not.toContain('另一條注釋')
  })

  it('adds auditable source, licence, attribution, and an explicitly curated retrieval index', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-corpus-'))
    temporaryDirectories.push(directory)
    const input = join(directory, 'source.wiki')
    const metadata = join(directory, 'metadata.json')
    const verification = join(directory, 'verification.pdf')
    const output = join(directory, 'corpus.json')
    const source = '==一章==\n道可道，非常道。'
    writeFileSync(input, source, 'utf8')
    writeFileSync(metadata, JSON.stringify([{ id: 1, retrieval_terms: ['内耗', '行动', '等待'] }]), 'utf8')
    writeFileSync(verification, 'public-domain-scan', 'utf8')
    const verificationSha256 = createHash('sha256').update('public-domain-scan', 'utf8').digest('hex').toUpperCase()
    const sha256 = createHash('sha256').update(Buffer.from(source, 'utf8')).digest('hex').toUpperCase()

    const run = spawnSync(process.execPath, [
      resolve(process.cwd(), 'scripts/corpus/build-wang-bi-corpus.mjs'),
      '--input', input,
      '--metadata', metadata,
      '--output', output,
      '--expected-sha256', sha256,
      '--expected-chapters', '1',
      '--verification-file', verification,
      '--verification-sha256', verificationSha256,
    ], { encoding: 'utf8' })

    expect(run.status, run.stderr).toBe(0)
    const built = JSON.parse(readFileSync(output, 'utf8'))
    expect(built).toMatchObject({
      edition: '道德經（王弼本·維基文庫固定版本2354026）',
      source: {
        revisionId: '2354026',
        revisionUrl: 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026',
        license: 'CC-BY-SA-4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        historyUrl: 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&action=history',
        discussionUrl: 'https://zh.wikisource.org/wiki/Talk:道德經_(王弼本)',
        originalWorkRights: 'public-domain',
        attribution: '《道德經（王弼本）》，中文維基文庫固定版本 2354026；原錄入來源標注為中國哲學書電子化計劃。',
        changeNotice: 'DaoFlow 僅抽取經文正文，移除王弼注文及模板，並按章節重組；未改寫經文字詞。',
      },
    })
    expect(built.chunks[0]).toMatchObject({
      edition: '道德經（王弼本·維基文庫固定版本2354026）',
      sourceRevision: '2354026',
      sourceUrl: 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026',
      license: 'CC-BY-SA-4.0',
      themeTerms: ['内耗', '行动', '等待'],
    })
    expect(built.verificationSources).toEqual([expect.objectContaining({
      title: '《新式標點老子道德經》',
      publication: '上海掃葉山房，1925',
      fileSha256: verificationSha256,
      rights: 'public-domain',
      collationReport: 'docs/redesign-v2/reviews/2026-09-15-WANG-BI-CORPUS-COLLATION.md',
    })])
  })

  it('refuses a partial retrieval index so unreviewed chapters cannot slip into the release', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daoflow-corpus-'))
    temporaryDirectories.push(directory)
    const input = join(directory, 'source.wiki')
    const metadata = join(directory, 'metadata.json')
    const source = '==一章==\n道可道，非常道。\n==二章==\n天下皆知美之為美。'
    writeFileSync(input, source, 'utf8')
    writeFileSync(metadata, JSON.stringify([{ id: 1, retrieval_terms: ['名与实'] }]), 'utf8')
    const sha256 = createHash('sha256').update(Buffer.from(source, 'utf8')).digest('hex').toUpperCase()
    const run = spawnSync(process.execPath, [
      resolve(process.cwd(), 'scripts/corpus/build-wang-bi-corpus.mjs'),
      '--input', input,
      '--metadata', metadata,
      '--output', join(directory, 'corpus.json'),
      '--expected-sha256', sha256,
      '--expected-chapters', '2',
    ], { encoding: 'utf8' })
    expect(run.status).not.toBe(0)
    expect(run.stderr).toContain('CHAPTER_METADATA_COVERAGE_INVALID')
  })
})

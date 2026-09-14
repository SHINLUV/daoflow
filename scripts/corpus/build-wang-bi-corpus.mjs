import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const options = argumentsFrom(process.argv.slice(2))
const input = required(options, 'input')
const output = required(options, 'output')
const expectedSha256 = required(options, 'expected-sha256').toUpperCase()
const expectedChapters = Number(required(options, 'expected-chapters'))
const sourceBytes = readFileSync(input)
const actualSha256 = createHash('sha256').update(sourceBytes).digest('hex').toUpperCase()
const metadata = options.has('metadata') ? chapterMetadata(readFileSync(options.get('metadata'), 'utf8'), expectedChapters) : new Map()
const verificationSources = verificationFrom(options)
const edition = '道德經（王弼本·維基文庫固定版本2354026）'
const revisionId = '2354026'
const revisionUrl = 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&oldid=2354026'
const license = 'CC-BY-SA-4.0'

if (actualSha256 !== expectedSha256) throw new Error(`SOURCE_SHA256_MISMATCH expected=${expectedSha256} actual=${actualSha256}`)

const chunks = extractChapters(sourceBytes.toString('utf8')).map(chapter => ({
  chunkId: `wang-bi-${String(chapter.chapter).padStart(2, '0')}-original`,
  chapter: chapter.chapter,
  paragraph: null,
  kind: 'original',
  content: chapter.content,
  contentSha256: createHash('sha256').update(chapter.content, 'utf8').digest('hex').toUpperCase(),
  edition,
  sourceRevision: revisionId,
  sourceUrl: revisionUrl,
  license,
  themeTerms: themesFor(metadata.get(chapter.chapter) ?? []),
  reviewStatus: 'pending',
}))

if (!Number.isInteger(expectedChapters) || expectedChapters < 1 || chunks.length !== expectedChapters) {
  throw new Error(`CHAPTER_COUNT_MISMATCH expected=${expectedChapters} actual=${chunks.length}`)
}
for (let index = 0; index < chunks.length; index += 1) {
  if (chunks[index].chapter !== index + 1) throw new Error(`CHAPTER_SEQUENCE_INVALID at=${index + 1}`)
}

writeFileSync(output, `${JSON.stringify({
  schemaVersion: 1,
  corpusVersion: 'dao-de-jing-wang-bi-v1',
  edition,
  status: 'pending_independent_content_review',
  source: {
    revisionId,
    revisionUrl,
    rawUtf8Sha256: actualSha256,
    license,
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    historyUrl: 'https://zh.wikisource.org/w/index.php?title=道德經_(王弼本)&action=history',
    discussionUrl: 'https://zh.wikisource.org/wiki/Talk:道德經_(王弼本)',
    originalWorkRights: 'public-domain',
    attribution: '《道德經（王弼本）》，中文維基文庫固定版本 2354026；原錄入來源標注為中國哲學書電子化計劃。',
    changeNotice: 'DaoFlow 僅抽取經文正文，移除王弼注文及模板，並按章節重組；未改寫經文字詞。',
  },
  verificationSources,
  chunks,
}, null, 2)}\n`, 'utf8')

function verificationFrom(optionMap) {
  const hasFile = optionMap.has('verification-file')
  const hasSha = optionMap.has('verification-sha256')
  if (!hasFile && !hasSha) return []
  if (!hasFile || !hasSha) throw new Error('VERIFICATION_ARGUMENTS_INCOMPLETE')
  const expected = optionMap.get('verification-sha256').toUpperCase()
  const actual = createHash('sha256').update(readFileSync(optionMap.get('verification-file'))).digest('hex').toUpperCase()
  if (actual !== expected) throw new Error(`VERIFICATION_SHA256_MISMATCH expected=${expected} actual=${actual}`)
  return [{
    title: '《新式標點老子道德經》',
    publication: '上海掃葉山房，1925',
    holdingInstitution: '中國國家圖書館',
    commonsUrl: 'https://commons.wikimedia.org/wiki/File:NLC511-027032013014585-17123_新式標點老子道德經.pdf',
    publicDomainMarkUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
    fileSha256: actual,
    rights: 'public-domain',
    purpose: 'cross-edition visual collation; variants are recorded rather than silently normalized',
    collationReport: 'docs/redesign-v2/reviews/2026-09-15-WANG-BI-CORPUS-COLLATION.md',
  }]
}

function chapterMetadata(raw, expectedCount) {
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) throw new Error('CHAPTER_METADATA_INVALID')
  const mapped = new Map(parsed.map(item => {
    if (!item || typeof item !== 'object' || !Number.isInteger(item.id) || !Array.isArray(item.retrieval_terms)
      || item.retrieval_terms.some(term => typeof term !== 'string' || !term.trim())) throw new Error('CHAPTER_METADATA_INVALID')
    return [item.id, item.retrieval_terms]
  }))
  if (mapped.size !== expectedCount
    || Array.from({ length: expectedCount }, (_, index) => index + 1).some(chapter => !mapped.has(chapter))) {
    throw new Error('CHAPTER_METADATA_COVERAGE_INVALID')
  }
  return mapped
}

function themesFor(tags) {
  return Array.from(new Set(tags.map(tag => tag.trim())))
}

function extractChapters(source) {
  const chapters = []
  let current = null
  for (const rawLine of source.split(/\r?\n/)) {
    const heading = rawLine.match(/^==\s*([一二三四五六七八九十百]+)章\s*==\s*$/)
    if (heading) {
      if (current) chapters.push(finish(current))
      current = { chapter: chineseNumber(heading[1]), lines: [] }
      continue
    }
    if (current && /^=+[^=].*=+\s*$/.test(rawLine)) {
      chapters.push(finish(current))
      current = null
      continue
    }
    if (!current) continue
    const line = rawLine.trim()
    if (!line || line.startsWith(':')) continue
    const normalized = line.replace(/-\{([^{}]+)\}-/g, '$1').trim()
    if (normalized) current.lines.push(normalized)
  }
  if (current) chapters.push(finish(current))
  return chapters
}

function finish(chapter) {
  const content = chapter.lines.join('\n').trim()
  if (!content) throw new Error(`CHAPTER_EMPTY chapter=${chapter.chapter}`)
  return { chapter: chapter.chapter, content }
}

function chineseNumber(value) {
  const digits = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (value === '十') return 10
  if (value === '百') return 100
  const [tens, ones] = value.split('十')
  if (ones !== undefined) return (tens ? digits[tens] : 1) * 10 + (ones ? digits[ones] : 0)
  return digits[value]
}

function argumentsFrom(values) {
  const result = new Map()
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index]
    const value = values[index + 1]
    if (!key?.startsWith('--') || value === undefined) throw new Error('INVALID_ARGUMENTS')
    result.set(key.slice(2), value)
  }
  return result
}

function required(optionsMap, name) {
  const value = optionsMap.get(name)
  if (!value) throw new Error(`MISSING_ARGUMENT --${name}`)
  return value
}

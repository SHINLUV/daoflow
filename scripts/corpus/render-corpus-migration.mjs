import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const options = argumentsFrom(process.argv.slice(2))
const input = required(options, 'input')
const output = required(options, 'output')
const manifestPath = required(options, 'manifest-path')
const expectedChapters = Number(required(options, 'expected-chapters'))
const release = JSON.parse(readFileSync(input, 'utf8'))

validateRelease(release, expectedChapters)

const documentId = deterministicUuid(`document:${release.corpusVersion}:${release.source.revisionId}`)
const reviewedAt = `${sql(release.review.approvedAt)}::timestamptz`
const reviewedBy = sql(release.review.approvedBy)
const values = release.chunks.map(chunk => `  (${[
  sql(chunk.chunkId),
  sql(documentId),
  sql(release.corpusVersion),
  sql(chunk.edition),
  String(chunk.chapter),
  chunk.paragraph === null ? 'null' : String(chunk.paragraph),
  sql(chunk.kind),
  sql(chunk.content),
  sql(chunk.contentSha256),
  sql(chunk.sourceUrl),
  sql(chunk.sourceRevision),
  sql(chunk.license),
  sqlArray(chunk.themeTerms),
  "'approved'",
  reviewedBy,
  reviewedAt,
].join(', ')})`).join(',\n')

const migration = `-- Trusted Wang Bi corpus release generated from a fixed, independently reviewed artifact.
-- document: wang-bi-${release.source.revisionId}-document (${documentId})
-- Forward-only and scoped to dao_corpus_* tables; private account data is untouched.

insert into public.dao_corpus_versions (
  corpus_version, edition, source_url, source_revision, source_sha256, license,
  review_status, manifest_path, reviewed_by, reviewed_at
) values (
  ${sql(release.corpusVersion)}, ${sql(release.edition)}, ${sql(release.source.revisionUrl)},
  ${sql(release.source.revisionId)}, ${sql(release.source.rawUtf8Sha256)}, ${sql(release.source.license)},
  'approved', ${sql(manifestPath)}, ${reviewedBy}, ${reviewedAt}
)
on conflict (corpus_version) do update set
  edition = excluded.edition,
  source_url = excluded.source_url,
  source_revision = excluded.source_revision,
  source_sha256 = excluded.source_sha256,
  license = excluded.license,
  review_status = excluded.review_status,
  manifest_path = excluded.manifest_path,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at;

insert into public.dao_corpus_documents (
  id, corpus_version, edition, source_url, source_revision, license, content_sha256,
  review_status, reviewed_by, reviewed_at
) values (
  ${sql(documentId)}, ${sql(release.corpusVersion)}, ${sql(release.edition)},
  ${sql(release.source.revisionUrl)}, ${sql(release.source.revisionId)}, ${sql(release.source.license)},
  ${sql(release.source.rawUtf8Sha256)}, 'approved', ${reviewedBy}, ${reviewedAt}
)
on conflict (id) do update set
  corpus_version = excluded.corpus_version,
  edition = excluded.edition,
  source_url = excluded.source_url,
  source_revision = excluded.source_revision,
  license = excluded.license,
  content_sha256 = excluded.content_sha256,
  review_status = excluded.review_status,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at;

insert into public.dao_corpus_chunks (
  chunk_id, document_id, corpus_version, edition, chapter, paragraph, kind, content,
  content_sha256, source_url, source_revision, license, theme_terms,
  review_status, reviewed_by, reviewed_at
) values
${values}
on conflict (chunk_id) do update set
  document_id = excluded.document_id,
  corpus_version = excluded.corpus_version,
  edition = excluded.edition,
  chapter = excluded.chapter,
  paragraph = excluded.paragraph,
  kind = excluded.kind,
  content = excluded.content,
  content_sha256 = excluded.content_sha256,
  source_url = excluded.source_url,
  source_revision = excluded.source_revision,
  license = excluded.license,
  theme_terms = excluded.theme_terms,
  review_status = excluded.review_status,
  reviewed_by = excluded.reviewed_by,
  reviewed_at = excluded.reviewed_at;

do $$
declare
  actual_chunks integer;
  actual_approved integer;
  actual_chapters integer;
  actual_documents integer;
begin
  select count(*), count(*) filter (where review_status = 'approved'), count(distinct chapter)
    into actual_chunks, actual_approved, actual_chapters
    from public.dao_corpus_chunks
    where corpus_version = ${sql(release.corpusVersion)};
  select count(*) into actual_documents
    from public.dao_corpus_documents
    where corpus_version = ${sql(release.corpusVersion)};
  if actual_chunks <> ${expectedChapters}
    or actual_approved <> ${expectedChapters}
    or actual_chapters <> ${expectedChapters}
    or actual_documents <> 1
    or not exists (
      select 1 from public.dao_corpus_versions
      where corpus_version = ${sql(release.corpusVersion)} and review_status = 'approved'
    ) then
    raise exception 'CORPUS_POSTCONDITION_FAILED version=% chunks=% approved=% chapters=% documents=%',
      ${sql(release.corpusVersion)}, actual_chunks, actual_approved, actual_chapters, actual_documents;
  end if;
end $$;
`

writeFileSync(output, migration, 'utf8')

function validateRelease(value, expectedCount) {
  if (!value || value.status !== 'approved') throw new Error('CORPUS_NOT_APPROVED')
  if (!Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > 81) throw new Error('EXPECTED_CHAPTERS_INVALID')
  if (!nonEmpty(value.corpusVersion) || !nonEmpty(value.edition)) throw new Error('CORPUS_RELEASE_INVALID')
  const source = value.source
  if (!source || !nonEmpty(source.revisionId) || !nonEmpty(source.revisionUrl)
    || !sha256(source.rawUtf8Sha256) || !nonEmpty(source.license) || !nonEmpty(source.attribution)) {
    throw new Error('CORPUS_SOURCE_INVALID')
  }
  if (!value.review || !nonEmpty(value.review.approvedBy)
    || Number.isNaN(Date.parse(value.review.approvedAt))) throw new Error('CORPUS_REVIEW_INVALID')
  if (!Array.isArray(value.chunks) || value.chunks.length !== expectedCount) throw new Error('CORPUS_CHUNKS_INVALID')
  const ids = new Set()
  for (let index = 0; index < value.chunks.length; index += 1) {
    const chunk = value.chunks[index]
    if (!chunk || !nonEmpty(chunk.chunkId) || ids.has(chunk.chunkId) || !Number.isInteger(chunk.chapter)
      || chunk.chapter !== index + 1 || chunk.chapter > 81 || (chunk.paragraph !== null && (!Number.isInteger(chunk.paragraph) || chunk.paragraph < 1))
      || chunk.kind !== 'original' || !nonEmpty(chunk.content) || !sha256(chunk.contentSha256)
      || createHash('sha256').update(chunk.content, 'utf8').digest('hex').toUpperCase() !== chunk.contentSha256.toUpperCase()
      || chunk.edition !== value.edition || chunk.sourceRevision !== source.revisionId || chunk.sourceUrl !== source.revisionUrl
      || chunk.license !== source.license || chunk.reviewStatus !== 'approved'
      || !Array.isArray(chunk.themeTerms) || chunk.themeTerms.some(term => !nonEmpty(term))) {
      throw new Error(`CORPUS_CHUNK_INVALID id=${chunk?.chunkId ?? 'unknown'}`)
    }
    ids.add(chunk.chunkId)
  }
}

function deterministicUuid(seed) {
  const hex = createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 32).split('')
  hex[12] = '5'
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4]
  const value = hex.join('')
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
}

function sql(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlArray(values) {
  return values.length ? `array[${values.map(sql).join(', ')}]::text[]` : 'array[]::text[]'
}

function sha256(value) {
  return typeof value === 'string' && /^[A-Fa-f0-9]{64}$/.test(value)
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
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

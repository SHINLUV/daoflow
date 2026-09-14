import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const options = argumentsFrom(process.argv.slice(2))
const input = required(options, 'input')
const output = required(options, 'output')
const expectedReleaseSha256 = required(options, 'expected-release-sha256').toUpperCase()
const reviewReportPath = required(options, 'review-report')
const expectedReviewSha256 = required(options, 'expected-review-sha256').toUpperCase()
const reviewer = required(options, 'reviewer').trim()
const reviewedAt = required(options, 'reviewed-at')
const expectedChapters = Number(required(options, 'expected-chapters'))

const releaseBytes = readFileSync(input)
const releaseSha256 = digest(releaseBytes)
if (releaseSha256 !== expectedReleaseSha256) {
  throw new Error(`RELEASE_SHA256_MISMATCH expected=${expectedReleaseSha256} actual=${releaseSha256}`)
}
const reportBytes = readFileSync(reviewReportPath)
const reportSha256 = digest(reportBytes)
if (reportSha256 !== expectedReviewSha256) {
  throw new Error(`REVIEW_SHA256_MISMATCH expected=${expectedReviewSha256} actual=${reportSha256}`)
}
const report = reportBytes.toString('utf8')
if (!/^FINAL_DECISION:\s*APPROVED\s*$/m.test(report)) throw new Error('REVIEW_NOT_APPROVED')
if (!reviewer || Number.isNaN(Date.parse(reviewedAt))) throw new Error('REVIEW_METADATA_INVALID')

const release = JSON.parse(releaseBytes.toString('utf8'))
if (release.status !== 'pending_independent_content_review') throw new Error('RELEASE_NOT_PENDING')
if (!Number.isInteger(expectedChapters) || expectedChapters < 1 || expectedChapters > 81
  || !Array.isArray(release.chunks) || release.chunks.length !== expectedChapters
  || release.chunks.some((chunk, index) => chunk?.chapter !== index + 1)
  || release.chunks.some(chunk => chunk?.reviewStatus !== 'pending')) {
  throw new Error('RELEASE_CHAPTERS_INVALID')
}

const approved = {
  ...release,
  status: 'approved',
  review: {
    approvedBy: reviewer,
    approvedAt: new Date(reviewedAt).toISOString(),
    reviewReportPath,
    reviewReportSha256: reportSha256,
    preApprovalReleaseSha256: releaseSha256,
  },
  chunks: release.chunks.map(chunk => ({ ...chunk, reviewStatus: 'approved' })),
}

writeFileSync(output, `${JSON.stringify(approved, null, 2)}\n`, 'utf8')

function digest(value) {
  return createHash('sha256').update(value).digest('hex').toUpperCase()
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

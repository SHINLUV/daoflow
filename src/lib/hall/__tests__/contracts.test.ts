import { describe, expect, it } from 'vitest'
import { HallInputError, parseHallListQuery, parsePublishInput, toPublicHallDto } from '../contracts'

const sourceHash = 'a'.repeat(64)
const uuid = '2ef7cc9a-b8b0-4a34-8ccd-3356ca9e9eb7'

describe('hall input and public DTO boundaries', () => {
  it('only accepts the declared submission fields and fixed redaction operations', () => {
    expect(parsePublishInput({
      sessionId: uuid,
      sourceHash,
      questionRedactions: [{ field: 'question', start: 0, end: 2 }],
      answerRedactions: [{ field: 'interpretation', start: 2, end: 5 }],
      consent: true,
      idempotencyKey: '753e0f9c-0d47-4c98-9667-f9466d16ec0b',
    })).toMatchObject({ sessionId: uuid, consent: true })
  })

  it('rejects client-supplied ownership, answer, provider, status, and citation rewrites', () => {
    const base = { sessionId: uuid, sourceHash, questionRedactions: [], answerRedactions: [], consent: true, idempotencyKey: '753e0f9c-0d47-4c98-9667-f9466d16ec0b' }
    expect(() => parsePublishInput({ ...base, ownerId: uuid })).toThrow(HallInputError)
    expect(() => parsePublishInput({ ...base, answerRedactions: [{ field: 'citations.0.quote', start: 0, end: 1 }] })).toThrow(HallInputError)
  })

  it('keeps public projection free of source, owner, email, report, audit and internal model fields', () => {
    const dto = toPublicHallDto({
      public_id: uuid,
      public_question: '如何安住此刻？',
      public_answer_snapshot: {
        summary: '先停一停。', citations: [{ chunk_id: 'chapter-08', chapter: 8, quote: '上善若水。', explanation: '借水说明柔和。' }], interpretation: '不急着对抗。', application: '留出一段空白。', boundary: '这不替代现实支持。', actions: ['先喝水'], reflection: '我在催促什么？',
      },
      provider: 'agnes', degraded: false, prompt_version: 'dao-answer-v2.1', corpus_version: 'wang-bi-v1', status: 'published', published_at: '2026-09-11T00:00:00.000Z',
      owner_id: uuid, email: 'private@example.test', source_session_id: uuid, source_entry_id: uuid, volume_id: uuid, report_note: 'private', audit_event: 'private', model: 'hidden-model',
    })
    expect(dto).toEqual({
      publicId: uuid, question: '如何安住此刻？', providerLabel: 'Agnes AI', promptVersion: 'dao-answer-v2.1', corpusVersion: 'wang-bi-v1', status: 'published', publishedAt: '2026-09-11T00:00:00.000Z',
      answer: { summary: '先停一停。', citations: [{ chunkId: 'chapter-08', chapter: 8, quote: '上善若水。', explanation: '借水说明柔和。' }], interpretation: '不急着对抗。', application: '留出一段空白。', boundary: '这不替代现实支持。', actions: ['先喝水'], reflection: '我在催促什么？' },
    })
    expect(JSON.stringify(dto)).not.toContain('private@example.test')
    expect(JSON.stringify(dto)).not.toContain('owner_id')
  })

  it('never turns fallback or unpublished data into a public Agnes DTO', () => {
    const row = { public_id: uuid, public_question: '问题', public_answer_snapshot: {}, provider: 'local', degraded: true, prompt_version: 'x', corpus_version: 'x', status: 'published', published_at: '2026-09-11T00:00:00Z' }
    expect(toPublicHallDto(row)).toBeNull()
  })

  it('bounds cursor, chapter, theme and page size before the RPC sees them', () => {
    expect(parseHallListQuery(new URLSearchParams('chapter=8&theme=%E5%8F%96%E8%88%8D&limit=12'))).toEqual({ cursor: null, chapter: 8, theme: '取舍', limit: 12 })
    expect(() => parseHallListQuery(new URLSearchParams('chapter=82'))).toThrow(HallInputError)
    expect(() => parseHallListQuery(new URLSearchParams('limit=21'))).toThrow(HallInputError)
  })
})

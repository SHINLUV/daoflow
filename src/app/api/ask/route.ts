import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { AskInputError, parseAskInput } from '@/lib/journal/ask-requests'
import { verifyMutationRequest } from '@/lib/auth/http'
import { generateDaoAnswerV2 } from '@/lib/ai/generateAnswerV2'
import { createConfiguredCorpusRepository, hasAskWorkerRunnerConfiguration, releaseAnonymousAsk, reserveAnonymousAsk } from '@/lib/ask-worker/runtime'
import type { AskAnswerResponse } from '@/lib/ask-worker/answerResponse'
import { AskRequestRpcError, enqueueAskWorkerRequest, hasAskServiceConfiguration } from '@/app/api/journal/ask-requests/server'

export const dynamic = 'force-dynamic'

function error(status: number, code: string, message: string, requestId: string, retryAfter?: number) {
  return NextResponse.json({ error: { code, message }, requestId }, {
    status,
    headers: { 'Cache-Control': 'no-store', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}) },
  })
}

/**
 * Authenticated requests only enqueue a lease-fenced durable job. Anonymous
 * requests never persist their text and only run while the trusted-IP/global
 * reservation and independently-approved corpus are both available.
 */
export async function POST(request: NextRequest) {
  const id = crypto.randomUUID()
  const security = verifyMutationRequest(request)
  if (!security.ok) return error(403, security.code, security.message, id)

  let input
  try {
    input = parseAskInput(await request.json())
  } catch (cause) {
    return error(400, 'INVALID_ASK', cause instanceof AskInputError ? cause.message : '请求体必须是合法 JSON。', id)
  }
  const requestId = input.requestId ?? id
  const hasOwnedLink = Boolean(input.sourceEntryId || input.volumeId)
  if (!isSupabaseConfigured) return error(503, 'ASK_AUTH_UNAVAILABLE', '问道身份服务尚未配置，未调用模型。', requestId)

  const supabase = createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    if (hasOwnedLink) return error(401, 'AUTH_REQUIRED', '请先登录后确认来源记录；未调用模型。', requestId)
    return anonymousAsk(request, input.question, requestId)
  }
  if (!hasAskServiceConfiguration() || !hasAskWorkerRunnerConfiguration()) return error(503, 'ASK_WORKER_UNAVAILABLE', '问道保存与生成服务尚未配置；未调用模型。', requestId)

  try {
    const queued = await enqueueAskWorkerRequest(user.id, { ...input, requestId })
    if (!queued?.request_id || !queued.state) return error(503, 'ASK_QUEUE_UNAVAILABLE', '暂时无法建立可恢复的问道请求。', requestId)
    return NextResponse.json({ requestId: queued.request_id, state: queued.state }, {
      status: 202,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '3' },
    })
  } catch (cause) {
    return queueError(cause, requestId)
  }
}

async function anonymousAsk(request: NextRequest, question: string, requestId: string) {
  let leaseId: string | null = null
  try {
    const reservation = await reserveAnonymousAsk(request)
    if (!reservation) return error(503, 'ANONYMOUS_LIMIT_UNAVAILABLE', '匿名问道限流尚未配置可信代理，未调用模型。', requestId)
    leaseId = reservation.leaseId
    const corpusRepository = createConfiguredCorpusRepository()
    if (!corpusRepository) return error(503, 'RAG_UNAVAILABLE', '可信经典库暂不可用，未调用模型。', requestId)
    const generated = await generateDaoAnswerV2(question, { corpusRepository })
    if (generated.kind === 'unavailable') {
      console.warn('anonymous_ask_agnes_unavailable', {
        requestId,
        failureKind: generated.failureKind,
        retryAfterSeconds: generated.retryAfterSeconds,
        attempts: generated.attempts.map(attempt => ({
          attempt: attempt.attempt,
          outcome: attempt.outcome,
          failureKind: attempt.failureKind,
          httpStatus: attempt.httpStatus,
          latencyMs: attempt.latencyMs,
        })),
      })
      return error(503, 'AGNES_UNAVAILABLE', 'Agnes 本次未能生成可验证的回答；没有改用静态章节或其他模型。', requestId, generated.retryAfterSeconds ?? undefined)
    }
    const body: AskAnswerResponse = {
      requestId,
      answerV2: generated.answer,
      provider: generated.provider,
      persistence: 'not_requested',
      sessionId: null,
      retrySaveAvailable: false,
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : ''
    if (/ANONYMOUS_DAILY_LIMIT|GLOBAL_DAILY_LIMIT/.test(message)) return error(429, 'ASK_RATE_LIMITED', '匿名问道已达到当前额度，请稍后再试。', requestId, 60)
    if (/GENERATION_CAPACITY/.test(message)) return error(429, 'ASK_GENERATION_BUSY', '当前问道人数较多，请稍后再试。', requestId, 15)
    return error(503, 'ANONYMOUS_ASK_UNAVAILABLE', '匿名问道暂不可用，未调用备用模型。', requestId)
  } finally {
    if (leaseId) await releaseAnonymousAsk(leaseId)
  }
}

function queueError(cause: unknown, requestId: string) {
  const message = cause instanceof Error ? cause.message : ''
  const code = cause instanceof AskRequestRpcError ? cause.code : undefined
  if (/SOURCE_NOT_FOUND|VOLUME_NOT_FOUND/.test(message) || code === 'P0002') return error(404, 'NOT_FOUND', '来源记录或卷册不存在，或你没有权限访问。', requestId)
  if (/IDEMPOTENCY_CONFLICT/.test(message) || code === 'P0001') return error(409, 'IDEMPOTENCY_CONFLICT', '该 requestId 已用于不同的问题或关联。', requestId)
  if (/ACCOUNT_DAILY_LIMIT|GLOBAL_DAILY_LIMIT/.test(message) || code === 'P0007') return error(429, 'ASK_RATE_LIMITED', '问道已达到当前额度，请稍后再试。', requestId, 60)
  return error(503, 'ASK_QUEUE_UNCERTAIN', '暂时无法确认问道请求状态；请使用同一 requestId 重试。', requestId)
}

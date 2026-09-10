import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import {
  type HallListQuery,
  type HallPublishInput,
  type HallReportInput,
  type HallReviewInput,
  type HallWithdrawInput,
  type MyHallPublicationDto,
  type PublicHallDto,
  toCursor,
  toMyHallPublicationDto,
  toPreviewDto,
  toPublicHallDto,
} from './contracts'

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> }
type AuthClient = RpcClient & { auth: { getUser: () => Promise<{ data: { user: HallUser | null }; error: unknown }> } }
type HallUser = { id: string; email_confirmed_at?: string | null; confirmed_at?: string | null }

export class HallServiceError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'HallServiceError'
  }
}

export function hallServiceHttpError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof HallServiceError) return { status: error.status, code: error.code, message: error.message }
  return { status: 500, code: 'HALL_OPERATION_FAILED', message: '同道大厅操作未完成，请稍后再试。' }
}

export type PublicHallPage = { items: PublicHallDto[]; nextCursor: string | null }
export type HallPreview = { sessionId: string; sourceHash: string; question: string; answer: PublicHallDto['answer'] }

export async function listPublicHall(query: HallListQuery): Promise<PublicHallPage> {
  const data = await rpc(publicClient(), 'hall_list_publications', {
    p_cursor: query.cursor,
    p_chapter: query.chapter,
    p_theme: query.theme,
    p_limit: query.limit,
  })
  if (!isRecord(data) || !Array.isArray(data.items)) throw invalidRpcResponse()
  const items = data.items.map(toPublicHallDto)
  if (items.some((item): item is null => item === null)) throw invalidRpcResponse()
  return { items: items as PublicHallDto[], nextCursor: toCursor(data.next_cursor) }
}

export async function getPublicHall(publicId: string): Promise<PublicHallDto> {
  const data = await rpc(publicClient(), 'hall_get_publication', { p_public_id: publicId })
  const publication = toPublicHallDto(data)
  if (!publication) throw new HallServiceError(404, 'NOT_FOUND', '该分享不存在或已撤回。')
  return publication
}

export async function getHallPreview(sessionId: string): Promise<HallPreview> {
  const { client } = await verifiedUserClient()
  const data = await rpc(client, 'hall_get_publication_preview', { p_session_id: sessionId })
  const preview = toPreviewDto(data)
  if (!preview) throw new HallServiceError(404, 'NOT_FOUND', '这条已保存问道不可用于公开分享。')
  return preview
}

export async function createHallPublication(input: HallPublishInput): Promise<MyHallPublicationDto> {
  const { client } = await verifiedUserClient()
  const data = await rpc(client, 'hall_create_publication', {
    p_session_id: input.sessionId,
    p_source_hash: input.sourceHash,
    p_question_redactions: input.questionRedactions,
    p_answer_redactions: input.answerRedactions,
    p_consent: true,
    p_idempotency_key: input.idempotencyKey,
  })
  const publication = toMyHallPublicationDto(data)
  if (!publication) throw invalidRpcResponse()
  return publication
}

export async function listMyHallPublications(): Promise<MyHallPublicationDto[]> {
  const { client } = await authenticatedUserClient()
  const data = await rpc(client, 'hall_list_my_publications', {})
  if (!Array.isArray(data)) throw invalidRpcResponse()
  const publications = data.map(toMyHallPublicationDto)
  if (publications.some((item): item is null => item === null)) throw invalidRpcResponse()
  return publications as MyHallPublicationDto[]
}

export async function withdrawHallPublication(publicId: string, input: HallWithdrawInput): Promise<MyHallPublicationDto> {
  const { client } = await authenticatedUserClient()
  const data = await rpc(client, 'hall_withdraw_publication', { p_public_id: publicId, p_expected_version: input.version })
  const publication = toMyHallPublicationDto(data)
  if (!publication) throw invalidRpcResponse()
  return publication
}

export async function reportHallPublication(publicId: string, input: HallReportInput): Promise<void> {
  const { client } = await authenticatedUserClient()
  const data = await rpc(client, 'hall_submit_report', { p_public_id: publicId, p_reason: input.reason, p_note: input.note })
  if (!isRecord(data) || data.accepted !== true) throw invalidRpcResponse()
}

export async function reviewHallPublication(publicId: string, input: HallReviewInput): Promise<MyHallPublicationDto> {
  const { client } = await authenticatedUserClient()
  const data = await rpc(client, 'hall_review_publication', { p_public_id: publicId, p_expected_version: input.version, p_decision: input.decision })
  const publication = toMyHallPublicationDto(data)
  if (!publication) throw invalidRpcResponse()
  return publication
}

async function authenticatedUserClient(): Promise<{ client: AuthClient; user: HallUser }> {
  if (!isSupabaseConfigured) throw new HallServiceError(503, 'HALL_UNAVAILABLE', '同道大厅服务尚未配置。')
  const client = createClient() as unknown as AuthClient
  let auth
  try {
    auth = await client.auth.getUser()
  } catch {
    throw new HallServiceError(503, 'HALL_UNAVAILABLE', '同道大厅服务暂时不可用。')
  }
  if (!auth.data.user) {
    if (auth.error && isAuthDependencyError(auth.error)) throw new HallServiceError(503, 'HALL_UNAVAILABLE', '同道大厅服务暂时不可用。')
    throw new HallServiceError(401, 'AUTH_REQUIRED', '请先登录后继续。')
  }
  return { client, user: auth.data.user }
}

async function verifiedUserClient(): Promise<{ client: AuthClient; user: HallUser }> {
  const context = await authenticatedUserClient()
  if (!context.user.email_confirmed_at && !context.user.confirmed_at) {
    throw new HallServiceError(403, 'EMAIL_VERIFICATION_REQUIRED', '请先完成邮箱验证后再提交分享。')
  }
  return context
}

function publicClient(): RpcClient {
  if (!isSupabaseConfigured) throw new HallServiceError(503, 'HALL_UNAVAILABLE', '同道大厅服务尚未配置。')
  return createClient() as unknown as RpcClient
}

async function rpc(client: RpcClient, name: string, args: Record<string, unknown>): Promise<unknown> {
  let result
  try {
    result = await client.rpc(name, args)
  } catch {
    throw new HallServiceError(503, 'HALL_UNAVAILABLE', '同道大厅服务暂时不可用。')
  }
  if (result.error) throw classifyError(result.error)
  return result.data
}

function classifyError(error: unknown): HallServiceError {
  const record = isRecord(error) ? error : {}
  const code = typeof record.code === 'string' ? record.code : ''
  if (code === 'P0002') return new HallServiceError(404, 'NOT_FOUND', '目标不存在或你没有权限访问。')
  if (code === 'P0003') return new HallServiceError(409, 'VERSION_CONFLICT', '内容已被更新，请刷新后重试。')
  if (code === 'P0004') return new HallServiceError(403, 'REVIEWER_REQUIRED', '此操作需要已启用 MFA 的审核权限。')
  if (code === 'P0005') return new HallServiceError(422, 'PUBLICATION_INELIGIBLE', '仅可分享已保存且已验证的 Agnes 回答。')
  if (code === 'P0006') return new HallServiceError(422, 'REGENERATE_REQUIRED', '公开文本不是纯脱敏，请重新生成对应回答。')
  if (code === '23505') return new HallServiceError(409, 'CONFLICT', '这条问道已存在分享记录。')
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') {
    return new HallServiceError(503, 'HALL_UNAVAILABLE', '同道大厅正在准备中，请稍后再试。')
  }
  return new HallServiceError(500, 'HALL_OPERATION_FAILED', '同道大厅操作未完成，请稍后再试。')
}

function invalidRpcResponse(): HallServiceError {
  return new HallServiceError(503, 'HALL_UNAVAILABLE', '同道大厅返回的数据暂不可用。')
}

function isAuthDependencyError(error: unknown): boolean {
  if (!isRecord(error)) return false
  const status = typeof error.status === 'number' ? error.status : 0
  const name = typeof error.name === 'string' ? error.name : ''
  return status === 0 || status >= 500 || name === 'AuthRetryableFetchError' || name === 'UnexpectedAuthError'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

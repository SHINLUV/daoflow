/**
 * 统一多供应商 AI 调用封装
 *
 * 三个供应商共用一套调用代码，通过 openai SDK 统一调用
 * Agnes 和 DeepSeek 均兼容 OpenAI Chat Completions 格式
 *
 * 自定义错误类型用于上层降级调度器区分失败原因
 */

import OpenAI from 'openai'

// ===== 自定义错误类型 =====

export class TimeoutError extends Error {
  constructor(message = 'AI 调用超时') {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class FormatError extends Error {
  constructor(message = 'AI 返回格式异常') {
    super(message)
    this.name = 'FormatError'
  }
}

// ===== 供应商类型 =====

export type Provider = 'agnes' | 'deepseek'

export type AgnesFailureKind =
  | 'missing_configuration'
  | 'unauthorized'
  | 'forbidden'
  | 'rate_limited'
  | 'timeout'
  | 'network'
  | 'server'
  | 'empty'
  | 'format_error'
  | 'invalid_json'
  | 'invalid_citation'
  | 'unknown'

/** Safe, metadata-only provider failure for durable attempt diagnostics. */
export class ProviderFailure extends Error {
  constructor(
    message: string,
    readonly provider: Provider,
    readonly kind: AgnesFailureKind,
    readonly statusCode?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ProviderFailure'
  }
}

export class UnauthorizedError extends ProviderFailure {
  constructor(provider: Provider, statusCode = 401) {
    super(`${provider} 身份验证失败 (${statusCode})`, provider, 'unauthorized', statusCode)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends ProviderFailure {
  constructor(provider: Provider, statusCode = 403) {
    super(`${provider} 无权使用当前模型 (${statusCode})`, provider, 'forbidden', statusCode)
    this.name = 'ForbiddenError'
  }
}

export class ServerError extends ProviderFailure {
  constructor(provider: Provider, statusCode: number) {
    super(`${provider} 上游服务错误 (${statusCode})`, provider, 'server', statusCode)
    this.name = 'ServerError'
  }
}

export class NetworkError extends ProviderFailure {
  constructor(provider: Provider, message = '网络请求失败') {
    super(`${provider} ${message}`, provider, 'network')
    this.name = 'NetworkError'
  }
}

export class EmptyResponseError extends ProviderFailure {
  constructor(provider: Provider) {
    super(`${provider} 返回空内容`, provider, 'empty')
    this.name = 'EmptyResponseError'
  }
}

export class RateLimitedError extends ProviderFailure {
  constructor(message = 'API 速率限制', provider: Provider = 'agnes', retryAfterSeconds?: number) {
    super(message, provider, 'rate_limited', 429, retryAfterSeconds)
    this.name = 'RateLimitedError'
  }
}

export interface CallModelOptions {
  timeout?: number        // 超时毫秒数
  temperature?: number
  maxTokens?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ProviderMetadata {
  provider: Provider
  model: string
  configured: boolean
}

// ===== 供应商配置 =====

const PROVIDER_CONFIG: Record<Provider, { baseURL: string; apiKey: string; model: string }> = {
  agnes: {
    baseURL: process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1',
    apiKey: process.env.AGNES_API_KEY || '',
    model: 'agnes-2.0-flash',
  },
  deepseek: {
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    model: 'deepseek-chat',
  },
}

/** Returns no secret material and is safe for a diagnostic status response. */
export function getProviderMetadata(provider: Provider): ProviderMetadata {
  const config = PROVIDER_CONFIG[provider]
  return { provider, model: config.model, configured: Boolean(config.apiKey) }
}

/**
 * 统一 AI 调用函数
 *
 * @param provider 供应商名称
 * @param messages 消息列表
 * @param options 可选配置（timeout, temperature 等）
 * @returns 模型原始返回文本
 *
 * @throws TimeoutError 超时
 * @throws RateLimitedError 速率限制（HTTP 429）
 * @throws Error 其他网络/API 错误
 */
export async function callModel(
  provider: Provider,
  messages: ChatMessage[],
  options: CallModelOptions = {}
): Promise<string> {
  const config = PROVIDER_CONFIG[provider]
  const { timeout = 8000, temperature = 0.3, maxTokens = 2048 } = options

  if (!config.apiKey) {
    throw new ProviderFailure(`${provider} 未配置`, provider, 'missing_configuration')
  }

  const client = new OpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    timeout,
    maxRetries: 0, // 不重试，失败即降级
  })

  try {
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(provider === 'agnes' ? { response_format: { type: 'json_object' as const } } : {}),
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new EmptyResponseError(provider)
    }

    return content
  } catch (error: unknown) {
    throw normalizeModelFailure(error, provider, timeout)
  }
}

/**
 * Normalize provider-library failures before the fallback layer persists a
 * user-visible reason. OpenAI's timeout wording is "Request timed out.",
 * which is distinct from the older "timeout" spelling and must not be
 * presented as a generic outage.
 */
export function normalizeModelFailure(error: unknown, provider: Provider, timeout: number): Error {
  if (error instanceof ProviderFailure) return error
  if (error instanceof FormatError) return error

  const err = error as Record<string, unknown>
  const status = typeof err?.status === 'number' ? err.status : undefined
  if (status === 401) return new UnauthorizedError(provider)
  if (status === 403) return new ForbiddenError(provider)
  if (status === 429) return new RateLimitedError(`${provider} 速率限制 (429)`, provider, readRetryAfterSeconds(err))
  if (status && status >= 500 && status <= 599) return new ServerError(provider, status)

  const errMsg = typeof err?.message === 'string' ? err.message : ''
  const errName = typeof err?.name === 'string' ? err.name : ''
  const errCode = typeof err?.code === 'string' ? err.code : ''
  if (isTimeoutFailure(errMsg, errName, errCode)) return new TimeoutError(`${provider} 调用超时 (${timeout}ms)`)
  if (isNetworkFailure(errName, errCode, errMsg)) return new NetworkError(provider)

  return new Error(`${provider} 调用失败: ${errMsg || String(err)}`)
}

export function classifyAgnesFailure(error: unknown): AgnesFailureKind {
  if (error instanceof ProviderFailure) return error.kind
  if (error instanceof TimeoutError) return 'timeout'
  if (error instanceof RateLimitedError) return 'rate_limited'
  if (error instanceof FormatError) return 'format_error'
  return 'unknown'
}

export function retryAfterSeconds(error: unknown): number | null {
  return error instanceof ProviderFailure && typeof error.retryAfterSeconds === 'number'
    ? error.retryAfterSeconds
    : null
}

function readRetryAfterSeconds(error: Record<string, unknown>): number | undefined {
  const headers = error.headers as { get?: (name: string) => string | null } | undefined
  const raw = headers?.get?.('retry-after')
  if (!raw) return undefined
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds)

  const retryAt = Date.parse(raw)
  return Number.isFinite(retryAt)
    ? Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))
    : undefined
}

function isNetworkFailure(name: string, code: string, message: string): boolean {
  if (/APIConnectionError|FetchError|NetworkError/i.test(name)) return true
  if (/^E(?:AI_AGAIN|CONNREFUSED|CONNRESET|HOSTUNREACH|NETUNREACH|PIPE)$/i.test(code)) return true
  return /network|socket|connection (?:closed|refused|reset)|dns/i.test(message)
}

function isTimeoutFailure(message: string, name: string, code: string): boolean {
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'UND_ERR_CONNECT_TIMEOUT') return true
  if (/timeout/i.test(name)) return true
  return /\btimeout\b|\btimed\s+out\b|\babort(?:ed|ing)?\b|\bdeadline\s+exceeded\b/i.test(message)
}

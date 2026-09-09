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

export class RateLimitedError extends Error {
  constructor(message = 'API 速率限制') {
    super(message)
    this.name = 'RateLimitedError'
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

export interface CallModelOptions {
  timeout?: number        // 超时毫秒数
  temperature?: number
  maxTokens?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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
    throw new Error(`${provider} API key 未配置，请检查环境变量`)
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
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new FormatError(`${provider} 返回空内容`)
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
  if (error instanceof FormatError) return error

  const err = error as Record<string, unknown>
  if (err?.status === 429) return new RateLimitedError(`${provider} 速率限制 (429)`)

  const errMsg = typeof err?.message === 'string' ? err.message : ''
  const errName = typeof err?.name === 'string' ? err.name : ''
  const errCode = typeof err?.code === 'string' ? err.code : ''
  if (isTimeoutFailure(errMsg, errName, errCode)) return new TimeoutError(`${provider} 调用超时 (${timeout}ms)`)

  return new Error(`${provider} 调用失败: ${errMsg || String(err)}`)
}

function isTimeoutFailure(message: string, name: string, code: string): boolean {
  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || code === 'UND_ERR_CONNECT_TIMEOUT') return true
  if (/timeout/i.test(name)) return true
  return /\btimeout\b|\btimed\s+out\b|\babort(?:ed|ing)?\b|\bdeadline\s+exceeded\b/i.test(message)
}

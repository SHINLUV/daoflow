/**
 * AI 返回结构解析器
 *
 * 防御性清洗 + Schema 校验：
 *   1. 先尝试直接 JSON.parse
 *   2. 失败则去除可能的 ```json / ``` 包裹后再解析
 *   3. 校验字段: matched_chapter 1-81, interpretation 和 follow_up_question 必须是字符串
 */

import { FormatError } from './callModel'

export interface AskResponse {
  matched_chapter: number
  interpretation: string
  follow_up_question: string
}

/**
 * 解析并校验 AI 返回的 JSON 结构
 *
 * @param rawText 模型返回的原始文本
 * @returns 校验通过的 AskResponse 对象
 * @throws FormatError 解析或校验失败
 */
export function parseStructuredResponse(rawText: string): AskResponse {
  if (!rawText || rawText.trim() === '') {
    throw new FormatError('AI 返回内容为空')
  }

  let parsed: unknown

  // 步骤 1: 直接尝试解析
  try {
    parsed = JSON.parse(rawText.trim())
  } catch {
    // 步骤 2: 尝试去除 markdown 代码块包裹
    parsed = tryParseMarkdownWrapped(rawText)
  }

  // 步骤 3: Schema 校验
  return validateAskResponse(parsed)
}

/**
 * 尝试从 markdown 代码块中提取 JSON
 */
function tryParseMarkdownWrapped(text: string): unknown {
  // 匹配 ```json ... ``` 或 ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim())
  }

  // 匹配以 { 开头、} 结尾的 JSON（可能被少量文字包围）
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0])
  }

  throw new FormatError('无法从返回文本中提取 JSON 结构')
}

/**
 * Schema 校验
 */
function validateAskResponse(data: unknown): AskResponse {
  if (typeof data !== 'object' || data === null) {
    throw new FormatError('返回数据不是合法对象')
  }

  const obj = data as Record<string, unknown>

  // matched_chapter: 必须是 1-81 之间的整数
  if (typeof obj.matched_chapter !== 'number' || !Number.isInteger(obj.matched_chapter)) {
    throw new FormatError(`matched_chapter 不是整数: ${obj.matched_chapter}`)
  }
  if (obj.matched_chapter < 1 || obj.matched_chapter > 81) {
    throw new FormatError(`matched_chapter 超出范围 1-81: ${obj.matched_chapter}`)
  }

  // interpretation: 必须是字符串
  if (typeof obj.interpretation !== 'string' || obj.interpretation.trim() === '') {
    throw new FormatError('interpretation 缺失或为空')
  }

  // follow_up_question: 必须是字符串（允许空）
  if (typeof obj.follow_up_question !== 'string') {
    throw new FormatError('follow_up_question 不是字符串')
  }

  return {
    matched_chapter: obj.matched_chapter,
    interpretation: obj.interpretation.trim(),
    follow_up_question: obj.follow_up_question.trim(),
  }
}

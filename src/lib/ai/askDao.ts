/**
 * 三级降级调度器 — DaoFlow 核心逻辑
 *
 * 调用链路:
 *   askDao(question)
 *     ├─ 第一级: Agnes (agnes-2.0-flash), timeout=8s
 *     │    成功且通过 Schema 校验 → 返回 provider='agnes'
 *     │    失败 → 记录原因，进入第二级
 *     ├─ 第二级: DeepSeek (deepseek-chat), timeout=10s
 *     │    成功且通过 Schema 校验 → 返回 provider='deepseek'
 *     │    失败 → 记录原因，进入第三级
 *     └─ 第三级: 本地关键词匹配，无网络调用
 *          provider='local_fallback', degraded=true
 *
 * 原则: 每一级不重试，失败即降级，总延迟上限 ≤20 秒
 */

import { callModel, ChatMessage, TimeoutError, RateLimitedError, FormatError } from './callModel'
import { parseStructuredResponse } from './parseStructuredResponse'
import { getLocalChapter } from '../chapters'

// ===== 返回结构 =====

export interface AskDaoResult {
  matchedChapter: number
  interpretation: string
  followUpQuestion: string | null
  provider: 'agnes' | 'deepseek' | 'local_fallback'
  degraded: boolean
  fallbackReason: string | null      // 'timeout' | 'rate_limited' | 'format_error' | null
}

// ===== System Prompt 构建 =====

/**
 * 构建包含角色设定 + 81章全文的 System Prompt
 *
 * 使用随构建发布的已审核 81 章种子数据，避免模型请求受数据库可用性影响。
 */
const CHAPTERS_CONTEXT_PLACEHOLDER = '【81章全文待从数据库加载，当前为占位符】'

export function getLocalChaptersContext(): string {
  return Array.from({ length: 81 }, (_, index) => {
    const chapter = getLocalChapter(index + 1)!
    return `第${chapter.id}章：${chapter.original_text}`
  }).join('\n')
}

export function buildSystemPrompt(): string {
  return `你是《道德经》的讲解者，不是心理咨询师。你的任务是根据用户的困惑，从81章中匹配最相关的一章，给出不超过4句的白话解读，并提出一个引导用户自我反思的反问句。

重要规则：
- 不输出建议性结论，不替用户做决定
- 解读要引导用户回到《道德经》原文，获得自己的答案
- 严格只返回 JSON 格式，不要 markdown 代码块包裹，不要任何前后说明文字

输出格式：
{"matched_chapter": 44, "interpretation": "不超过4句的白话解读", "follow_up_question": "引导反思的反问句"}

《道德经》81章全文如下：
${CHAPTERS_CONTEXT_PLACEHOLDER}`
}

/**
 * 构建用户消息
 */
function buildUserMessage(question: string): string {
  return `用户的困惑：${question}

请根据以上困惑，从《道德经》81章中匹配最相关的一章，按指定 JSON 格式返回。`
}

// ===== 降级调度 =====

/**
 * 问道核心函数 — 三级降级调度
 *
 * @param question 用户输入的困惑
 * @param getChaptersContext 可选的81章内容获取函数（用于依赖注入/测试mock）
 */
export async function askDao(
  question: string,
  getChaptersContext?: () => Promise<string>
): Promise<AskDaoResult> {
  const chaptersContext = getChaptersContext ? await getChaptersContext() : getLocalChaptersContext()
  const systemPrompt = buildSystemPrompt().replace(CHAPTERS_CONTEXT_PLACEHOLDER, chaptersContext)

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildUserMessage(question) },
  ]

  // ---- 第一级: Agnes ----
  try {
    const raw = await callModel('agnes', messages, { timeout: 8000 })
    const parsed = parseStructuredResponse(raw)
    return {
      matchedChapter: parsed.matched_chapter,
      interpretation: parsed.interpretation,
      followUpQuestion: parsed.follow_up_question,
      provider: 'agnes',
      degraded: false,
      fallbackReason: null,
    }
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    const reason = classifyError(err)
    console.warn(`[askDao] Agnes 降级 (${reason}):`, err.message)

    // ---- 第二级: DeepSeek ----
    try {
      const raw = await callModel('deepseek', messages, { timeout: 10000 })
      const parsed = parseStructuredResponse(raw)
      return {
        matchedChapter: parsed.matched_chapter,
        interpretation: parsed.interpretation,
        followUpQuestion: parsed.follow_up_question,
        provider: 'deepseek',
        degraded: false,
        fallbackReason: null,
      }
    } catch (error2: unknown) {
      const err2 = error2 instanceof Error ? error2 : new Error(String(error2))
      const reason2 = classifyError(err2)
      console.warn(`[askDao] DeepSeek 降级 (${reason2}):`, err2.message)

      // ---- 第三级: 本地关键词匹配 ----
      return localFallback(question, reason2)
    }
  }
}

/**
 * 本地关键词匹配降级（保底方案）
 *
 * 本地可用性保底：匹配可审阅的静态关键词，再返回对应种子章节的预置解读。
 */
function localFallback(question: string, reason: AskDaoResult['fallbackReason']): AskDaoResult {
  // 关键词映射（硬编码版本，与 keyword_chapter_map 表一致）
  const keywordMap: Record<string, number[]> = {
    '迷茫': [33, 71, 64, 1],
    '焦虑': [44, 46, 12, 16],
    '不安': [16, 5, 23, 13],
    '烦躁': [26, 12, 45],
    '沮丧': [23, 40, 22, 41],
    '孤独': [20, 70, 62],
    '害怕': [13, 50, 73],
    '恐惧': [74, 13, 50, 73],
    '愤怒': [68, 31, 26],
    '悲伤': [23, 40, 62],
    '自责': [8, 33, 71, 62],
    '选择': [64, 2, 44, 63],
    '决定': [64, 73, 44],
    '辞职': [64, 9, 44],
    '转行': [64, 41, 70],
    '放弃': [48, 9, 64],
    '不知道怎么办': [64, 33, 71, 1],
    '关系': [8, 66, 61, 27],
    '冲突': [31, 68, 79],
    '沟通': [56, 17, 27],
    '家庭': [18, 54, 52],
    '朋友': [27, 62, 81],
    '伴侣': [61, 51, 66],
    '工作': [63, 64, 9, 17],
    '创业': [64, 59, 41],
    '失败': [40, 64, 22, 43],
    '成功': [9, 46, 24, 41],
    '压力': [44, 5, 48, 26],
    '加班': [44, 46, 9],
    '竞争': [68, 22, 66, 3],
    '改变': [48, 15, 64],
    '成长': [25, 54, 33],
    '学习': [48, 41, 71],
    '自我': [33, 7, 13, 70],
    '目标': [64, 63, 9],
    '意义': [1, 25, 41],
    '拖延': [63, 38, 64],
    '内卷': [3, 46, 44, 80],
    '躺平': [48, 80, 37],
    '累': [44, 48, 26, 9],
    '不公平': [77, 5, 58],
    '后悔': [64, 44, 79],
    '犹豫': [64, 73, 33],
  }

  // 关键词包含匹配
  const matches: number[][] = []
  const lowerQuestion = question.toLowerCase()

  for (const [keyword, chapterIds] of Object.entries(keywordMap)) {
    if (question.includes(keyword) || lowerQuestion.includes(keyword.toLowerCase())) {
      matches.push(chapterIds)
    }
  }

  let matchedChapter: number

  if (matches.length === 0) {
    // 完全没有命中 → 默认第一章（总纲）
    matchedChapter = 1
  } else if (matches.length === 1) {
    // 命中一个 → 取第一个候选
    matchedChapter = matches[0][0]
  } else {
    // 命中多个 → 取交集中的第一个，没有交集则取第一个匹配项的候选
    const intersection = matches.reduce((a, b) => a.filter(id => b.includes(id)))
    if (intersection.length > 0) {
      matchedChapter = intersection[0]
    } else {
      matchedChapter = matches[0][0]
    }
  }

  const chapter = getLocalChapter(matchedChapter)!

  return {
    matchedChapter,
    interpretation: chapter.preset_interpretation,
    followUpQuestion: null,  // 本地降级不提供反问句
    provider: 'local_fallback',
    degraded: true,
    fallbackReason: reason,
  }
}

/**
 * 分类错误类型，返回 fallback_reason 字符串
 */
function classifyError(error: Error): string {
  if (error instanceof TimeoutError) return 'timeout'
  if (error instanceof RateLimitedError) return 'rate_limited'
  if (error instanceof FormatError) return 'format_error'
  return 'unknown'
}

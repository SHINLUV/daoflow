import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { retrieveApprovedLexically } from '../approvedLexical'
import type { ApprovedCorpusRepository, CorpusChunkRecord } from '../types'

const release = JSON.parse(readFileSync(resolve(process.cwd(), 'docs/redesign-v2/corpus/dao-de-jing-wang-bi-v1.release.json'), 'utf8'))
const chunks: CorpusChunkRecord[] = release.chunks.map((chunk: Record<string, unknown>) => ({
  chunkId: chunk.chunkId,
  chapter: chunk.chapter,
  paragraph: chunk.paragraph,
  text: chunk.content,
  edition: chunk.edition,
  kind: chunk.kind,
  reviewStatus: 'approved',
  corpusVersion: release.corpusVersion,
  sourceRevision: chunk.sourceRevision,
  sourceUrl: chunk.sourceUrl,
  license: chunk.license,
  themeTerms: chunk.themeTerms,
}))

const repository: ApprovedCorpusRepository = {
  getRuntimePolicy: vi.fn().mockResolvedValue({ eligibility: 'eligible', corpusVersion: release.corpusVersion, reason: 'quality-test' }),
  listChunksForLexicalRetrieval: vi.fn().mockResolvedValue(chunks),
}

const cases: Array<{ question: string; acceptable: number[] }> = [
  { question: '我总是在意别人怎么看我，越想越内耗，怎么办？', acceptable: [13, 44] },
  { question: '我看不到自己的长处，也不知道自己的局限。', acceptable: [33, 71] },
  { question: '做的事情被人嘲笑，我还应该坚持吗？', acceptable: [41, 70] },
  { question: '我总想证明自己、炫耀成绩，停不下来。', acceptable: [24, 33] },
  { question: '怎样接受自己的不完美和笨拙？', acceptable: [28, 45] },
  { question: '最近很焦虑，心怎么都静不下来。', acceptable: [16, 45] },
  { question: '我患得患失，总怕失去已经拥有的东西。', acceptable: [13, 44, 46] },
  { question: '信息太多让我分心，怎样关掉干扰？', acceptable: [12, 47, 52] },
  { question: '面对未来的不确定，我很害怕。', acceptable: [14, 58, 73] },
  { question: '看到别人过得好就攀比，欲望让我焦虑。', acceptable: [44, 46] },
  { question: '两个工作机会让我纠结，应该怎么选择取舍？', acceptable: [12, 32, 44] },
  { question: '这件事应该立即行动，还是耐心等待？', acceptable: [15, 37, 64] },
  { question: '创业项目什么时候应该停手，不再扩张？', acceptable: [9, 30, 44] },
  { question: '项目太复杂了，我应该从哪里开始执行？', acceptable: [63, 64] },
  { question: '面对高风险决策，勇气和谨慎怎么平衡？', acceptable: [26, 73] },
  { question: '亲密关系里怎样表达边界又不伤人？', acceptable: [8, 36, 52, 72] },
  { question: '家人争吵时，怎样柔和沟通并修复关系？', acceptable: [8, 18, 79] },
  { question: '和同事发生冲突，如何做到不争？', acceptable: [8, 22, 68] },
  { question: '心里有怨恨，怎样与对方和解？', acceptable: [63, 79] },
  { question: '我总替别人兜底，怎么守住自己的界限？', acceptable: [27, 52, 62, 72] },
  { question: '我是不是把团队管得太多了，怎样给成员自主？', acceptable: [17, 57, 66] },
  { question: '领导怎样做到功成不居，把功劳归给团队？', acceptable: [17, 34] },
  { question: '公司扩张太快，什么时候该收手止损？', acceptable: [9, 30, 44] },
  { question: '管理团队时如何少折腾、少干预？', acceptable: [57, 60] },
  { question: '创业时走捷径会有什么问题？', acceptable: [53, 63] },
  { question: '我总想强行掌控结果，怎样学会放手？', acceptable: [29, 37, 48] },
  { question: '事情越做越多，怎样给生活和工作做减法？', acceptable: [48, 80] },
  { question: '我很急躁，总想立刻看到结果。', acceptable: [15, 24, 26] },
  { question: '什么时候该顺势而为，不再硬推？', acceptable: [23, 37] },
  { question: '难事怎么拆小，从小处开始并坚持到底？', acceptable: [63, 64] },
]

describe('curated Wang Bi retrieval quality gate', () => {
  it('hits an independently acceptable chapter in Top 5 for at least 90% of 30 natural questions', async () => {
    const misses: Array<{ question: string; got: number[]; acceptable: number[] }> = []
    for (const testCase of cases) {
      const result = await retrieveApprovedLexically(testCase.question, repository, 5)
      const got = result.kind === 'evidence' ? result.evidence.map(item => item.chapter) : []
      if (!got.some(chapter => testCase.acceptable.includes(chapter))) misses.push({ ...testCase, got })
    }
    expect(misses, JSON.stringify(misses, null, 2)).toHaveLength(0)
  })
})

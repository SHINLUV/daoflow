import type { PublicAnswer } from '@/lib/hall/contracts'
import styles from './hall.module.css'

export function PublicAnswer({ answer }: { answer: PublicAnswer }) {
  return <div className={styles.answer}>
    <section><h2>看见困惑</h2><p>{answer.summary}</p></section>
    <section><h3>读懂原文</h3>{answer.citations.map(citation => <blockquote className={styles.citation} key={citation.chunkId}><p>“{citation.quote}”</p><cite>《道德经》第 {citation.chapter} 章 · {citation.explanation}</cite></blockquote>)}</section>
    <section><h3>照见此刻</h3><p>{answer.interpretation}</p></section>
    <section><h3>可以试试</h3><p>{answer.application}</p><ul>{answer.actions.map((action, index) => <li key={index}>{action}</li>)}</ul></section>
    <section><h3>也看另一面</h3><p>{answer.boundary}</p></section>
    <section><h3>反思问题</h3><p>{answer.reflection}</p></section>
  </div>
}

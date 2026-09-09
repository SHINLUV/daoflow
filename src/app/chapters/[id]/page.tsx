'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ReadingChapter } from '@/components/v2/reading/ReadingChapter'
import { PageTurn } from '@/components/v2/motion/PageTurn'
import styles from '@/components/v2/reading/reading.module.css'
import { getLocalChapter } from '@/lib/chapters'

export default function ChapterPage() {
  const { id } = useParams<{ id: string }>()
  const chapterId = Number(id)
  const chapter = /^\d+$/.test(id) && Number.isInteger(chapterId) && chapterId >= 1 && chapterId <= 81 ? getLocalChapter(chapterId) : null

  if (!chapter) {
    return <main id="main-content"><section className={styles.readingPage}><p className={styles.chapterKicker}>《道德经》</p><h1 className={styles.chapterTitle}>未找到这一章</h1><p className={styles.directoryIntro}>请从第一章至第八十一章中选择。</p><Link className={styles.quietButton} href="/chapters">返回经典目录</Link></section></main>
  }

  return <main id="main-content"><PageTurn chapterId={chapter.id}><article className={styles.readingPage}>
      <p className={styles.chapterKicker}>《道德经》 · 老子</p>
      <h1 className={styles.chapterTitle}>第 {chapter.id} 章</h1>
      <ReadingChapter chapter={{ id: chapter.id, originalText: chapter.original_text, vernacularText: chapter.vernacular_text }} />
      <nav className={styles.chapterNav} aria-label="章节翻页">
        {chapter.id > 1 ? <Link href={`/chapters/${chapter.id - 1}`}>← 第 {chapter.id - 1} 章</Link> : <span />}
        {chapter.id < 81 && <Link href={`/chapters/${chapter.id + 1}`}>第 {chapter.id + 1} 章 →</Link>}
      </nav>
    </article></PageTurn></main>
}

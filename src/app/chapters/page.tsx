import Link from 'next/link'
import styles from '@/components/v2/reading/reading.module.css'
import chapters from '../../../scripts/seed/chapters.json'

export default function ChaptersDirectoryPage() {
  return <main id="main-content"><section className={styles.directoryPage} aria-labelledby="chapters-title">
      <p className={styles.chapterKicker}>《道德经》 · 八十一章</p>
      <h1 id="chapters-title" className={styles.directoryTitle}>读经典</h1>
      <p className={styles.directoryIntro}>从一章原文开始，随时查看白话、收藏完整章节或连续片段，并写下只属于你的批注。</p>
      <ol className={styles.chapterGrid}>
        {chapters.map(chapter => <li key={chapter.id}><Link className={styles.chapterLink} href={`/chapters/${chapter.id}`} aria-label={`第 ${chapter.id} 章`}><span>第 {chapter.id} 章</span><small>{chapter.chapter_theme_tags.join(' · ')}</small></Link></li>)}
      </ol>
    </section></main>
}

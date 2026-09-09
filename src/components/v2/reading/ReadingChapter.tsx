'use client'

import { useState } from 'react'
import { FavoriteControls } from './FavoriteControls'
import styles from './reading.module.css'

export type ReadingChapterData = {
  id: number
  originalText: string
  vernacularText: string
}

export function ReadingChapter({ chapter }: { chapter: ReadingChapterData }) {
  const [showVernacular, setShowVernacular] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copyOriginal() {
    try {
      await navigator.clipboard.writeText(chapter.originalText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return <>
    <section className={styles.originalSection} aria-labelledby="chapter-original-title">
      <div className={styles.sectionHeading}>
        <h2 id="chapter-original-title">原文</h2>
        <button type="button" className={styles.quietButton} onClick={copyOriginal}>{copied ? '已复制原文' : '复制原文'}</button>
      </div>
      <p className={styles.originalText} data-reading-original>{chapter.originalText}</p>
    </section>

    <section className={styles.vernacularSection} aria-labelledby="chapter-vernacular-title">
      <div className={styles.sectionHeading}>
        <h2 id="chapter-vernacular-title">白话</h2>
        <button type="button" className={styles.quietButton} aria-expanded={showVernacular} onClick={() => setShowVernacular(value => !value)}>
          {showVernacular ? '收起白话' : '查看白话'}
        </button>
      </div>
      {showVernacular && <p className={styles.vernacularText}>{chapter.vernacularText}</p>}
    </section>

    <FavoriteControls chapterId={chapter.id} originalText={chapter.originalText} />
  </>
}

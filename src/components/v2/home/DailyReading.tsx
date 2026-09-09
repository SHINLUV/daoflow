import Link from 'next/link'
import Image from 'next/image'
import { EditorialReveal } from './EditorialReveal'
import { ArrowUpRight } from '@phosphor-icons/react'
import styles from './home.module.css'

export function DailyReading() {
  return <>
    <EditorialReveal><section className={styles.daily} aria-labelledby="daily-title">
      <div className={styles.dailyArt}><Image src="/daoflow-v2/a04-two-banks.webp" alt="青绿山水中的两岸与水流" fill sizes="(max-width: 760px) 90vw, 35vw" quality={45} /><span aria-hidden="true">水善利万物</span></div>
      <div className={styles.dailyCopy}><p className={styles.kicker}><span className={styles.sectionNumber}>叁</span> 经 典 一 句</p><blockquote id="daily-title">上善若水，<br />水善利万物而不争。</blockquote><p className={styles.dailyNote}>翻开一页，给此刻留一点余地。</p><Link href="/chapters/8">《道德经》第八章 <ArrowUpRight size={16} /></Link><Link className={styles.directoryLink} href="/chapters">翻阅八十一章 <span aria-hidden="true">→</span></Link></div>
    </section></EditorialReveal>
    <EditorialReveal><section id="about" className={styles.about}><p className={styles.kicker}>DAO FLOW · 留 白 之 处</p><h2>记下此刻，<br />慢慢回看自己的来处。</h2><p>这里不替你决定。它留出一张安静纸面，让生活的记录和经典的句子，在同一个地方互相照见。</p><span className={styles.colophon} aria-hidden="true">心有所寄 · 自有回响</span></section></EditorialReveal>
  </>
}

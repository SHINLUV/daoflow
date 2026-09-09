import Link from 'next/link'
import { ArrowUpRight } from '@phosphor-icons/react'
import styles from './home.module.css'

export function DailyReading() {
  return <>
    <section className={styles.daily} aria-labelledby="daily-title"><p className={styles.kicker}>经 典 一 句</p><blockquote id="daily-title">上善若水，水善利万物而不争。</blockquote><Link href="/chapters/8">《道德经》第八章 <ArrowUpRight size={16} /></Link></section>
    <section id="about" className={styles.about}><p className={styles.kicker}>关 于 DAO FLOW</p><h2>记下此刻，<br />慢慢回看自己的来处。</h2><p>这里不替你决定。它留出一张安静纸面，让生活的记录和经典的句子，在同一个地方互相照见。</p></section>
  </>
}

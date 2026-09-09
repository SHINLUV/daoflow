'use client'

import Image from 'next/image'
import { useRef, useState, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight } from '@phosphor-icons/react'
import { useDaoNavigation } from '../motion/MotionProvider'
import styles from './realms.module.css'

export const REALMS = [
  { id: 'still', title: '焦虑与情绪', word: '静', image: '/daoflow-v2/a03-still-water.webp', chapter: 16, quote: '致虚极，守静笃。', description: '让纷扰沉淀，听见内心的声音。', prompts: ['最近总是很焦虑，停不下来。', '我想知道怎样和情绪待在一起。', '这份不安，是否在提醒我什么？'] },
  { id: 'banks', title: '关系与边界', word: '和', image: '/daoflow-v2/a04-two-banks.webp', chapter: 8, quote: '上善若水。', description: '亲近他人，也安放好自己。', prompts: ['这段关系让我很困扰。', '我怎样表达自己的边界？', '温柔和退让，差别在哪里？'] },
  { id: 'fork', title: '选择与决策', word: '择', image: '/daoflow-v2/a05-forked-stream.webp', chapter: 44, quote: '知足不辱，知止不殆。', description: '在进退之间，找到自己的方向。', prompts: ['我面临一个重要选择。', '什么才是足够？', '我害怕失去什么？'] },
  { id: 'path', title: '事业与创业', word: '行', image: '/daoflow-v2/a06-mountain-path.webp', chapter: 64, quote: '千里之行，始于足下。', description: '有所作为，也有所不为。', prompts: ['工作中找不到方向和意义。', '眼前的一小步是什么？', '我该先放下哪件事？'] },
  { id: 'bamboo', title: '成长与自我', word: '生', image: '/daoflow-v2/a07-new-bamboo.webp', chapter: 33, quote: '知人者智，自知者明。', description: '向内看见，属于自己的力量。', prompts: ['感觉自己停滞不前。', '我真正了解自己吗？', '怎样听见自己的节奏？'] },
  { id: 'cloud', title: '无为与有为', word: '流', image: '/daoflow-v2/a08-flowing-clouds.webp', chapter: 48, quote: '为学日益，为道日损。', description: '像水一样，找到行动的节奏。', prompts: ['我该努力还是顺其自然？', '什么正在消耗我？', '可以先减去什么？'] },
] as const

export function SixRealms({ onChooseQuestion }: { onChooseQuestion: (question: string) => void }) {
  const [active, setActive] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const { motionEnabled } = useDaoNavigation()
  const realm = REALMS[active]
  function select(index: number, focus = false) {
    const next = (index + REALMS.length) % REALMS.length
    setActive(next)
    if (focus) tabs.current[next]?.focus({ preventScroll: true })
    // Only move the gallery's native scroll area, never the document viewport.
    const tab = tabs.current[next]
    const rail = tab?.parentElement
    if (tab && rail && rail.scrollWidth > rail.clientWidth) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      rail.scrollTo({ left: tab.offsetLeft - rail.offsetLeft, behavior: motionEnabled && !reduced ? 'smooth' : 'instant' })
    }
  }
  function onKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === 'ArrowRight' ? index + 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? REALMS.length - 1 : null
    if (next === null) return
    event.preventDefault()
    select(next, true)
  }
  return <section id="six-realms" className={styles.realms} data-motion={motionEnabled ? 'on' : 'off'} aria-labelledby="realm-title">
    <header className={styles.sectionHeading}><div><p className={styles.kicker}>六 境 · 由 心 入 道</p><h2 id="realm-title">每一种心境，都有回响。</h2></div><p>选一境，看一段原文，再把真正想问的事写下来。</p></header>
    <div className={styles.galleryMeta}><span>观 山 水 · 照 见 自 己</span><div><span className={styles.counter}>0{active + 1}<i> / 06</i></span><button type="button" onClick={() => select(active - 1)} aria-label="上一境"><ArrowLeft size={18} /></button><button type="button" onClick={() => select(active + 1)} aria-label="下一境"><ArrowRight size={18} /></button></div></div>
    <div className={styles.realmRail} role="tablist" aria-label="选择心境" aria-orientation="horizontal">
      {REALMS.map((item, index) => <button ref={node => { tabs.current[index] = node }} key={item.id} id={`realm-tab-${item.id}`} type="button" role="tab" aria-label={item.title} aria-controls="realm-panel" tabIndex={active === index ? 0 : -1} aria-selected={active === index} className={styles.realmCard} onClick={() => select(index)} onKeyDown={event => onKey(event, index)}>
        <Image src={item.image} alt={`${item.title}的青绿山水`} fill quality={45} sizes="(max-width: 760px) 72vw, 25vw" loading="lazy" />
        <span className={styles.realmWash} /><span className={styles.cardNumber}>卷 · 0{index + 1}</span><span className={styles.realmWord}>{item.word}</span><strong>{item.title}</strong><span className={styles.cardFoot}>入此境 <ArrowUpRight size={17} /></span>
      </button>)}
    </div>
    <article id="realm-panel" role="tabpanel" aria-labelledby={`realm-tab-${realm.id}`} className={styles.realmDetail} tabIndex={0}>
      <div key={realm.id} className={styles.quoteBlock}><span className={styles.detailSeal} aria-hidden="true">{realm.word}</span><div><p className={styles.kicker}>{realm.word} · 《道德经》第 {realm.chapter} 章</p><h3>{realm.quote}</h3><p>{realm.description}</p></div></div>
      <div className={styles.questionChoices}><span>可以从这里开始</span>{realm.prompts.map(question => <button type="button" key={question} onClick={() => onChooseQuestion(question)}>{question}<ArrowUpRight size={15} /></button>)}</div>
    </article>
  </section>
}

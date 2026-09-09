'use client'

import { useEffect, useRef, type PropsWithChildren } from 'react'
import styles from './home.module.css'

/** Progressive enhancement: content is readable before JS and with motion disabled. */
export function EditorialReveal({ children }: PropsWithChildren) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || !('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      element.dataset.revealed = 'true'
      observer.disconnect()
    }, { threshold: .12 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} className={styles.editorialReveal}>{children}</div>
}

import type { PropsWithChildren } from 'react'
import styles from './motion.module.css'

export function PageTurn({ chapterId, children }: PropsWithChildren<{ chapterId: number }>) {
  return <div className={styles.pageTurn} data-chapter={chapterId}>{children}</div>
}

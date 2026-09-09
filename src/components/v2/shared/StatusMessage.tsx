import type { PropsWithChildren } from 'react'
import styles from './shared.module.css'

export function StatusMessage({ kind, children }: PropsWithChildren<{ kind: 'loading' | 'success' | 'error' | 'empty' }>) {
  return <p className={`${styles.status} ${styles[kind] ?? ''}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</p>
}

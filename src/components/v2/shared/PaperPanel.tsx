import type { HTMLAttributes, PropsWithChildren } from 'react'
import styles from './shared.module.css'

export function PaperPanel({ children, className = '', ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return <section className={`${styles.paperPanel} ${className}`.trim()} {...props}>{children}</section>
}

import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import styles from './shared.module.css'

export function PrimaryButton({ children, className = '', type = 'button', ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button type={type} className={`${styles.primaryButton} ${className}`.trim()} {...props}>{children}</button>
}

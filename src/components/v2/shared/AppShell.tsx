import type { PropsWithChildren } from 'react'
import Footer from '@/components/Footer'
import NavBar from '@/components/NavBar'
import styles from './shared.module.css'

export function AppShell({ children, active }: PropsWithChildren<{ active: 'now' | 'journal' | 'reading' }>) {
  return <div className={styles.shell} data-active-section={active}>
    <NavBar />
    <main id="main-content" className={styles.main}>{children}</main>
    <Footer />
  </div>
}

'use client'

import styles from './home.module.css'

export type EntryMode = 'record' | 'ask'

export function EntryModeSwitcher({ value, onChange }: { value: EntryMode; onChange: (mode: EntryMode) => void }) {
  return <div className={styles.modeSwitcher} role="tablist" aria-label="此刻的书写方式">
    <button type="button" role="tab" aria-selected={value === 'record'} onClick={() => onChange('record')}>记下此刻</button>
    <button type="button" role="tab" aria-selected={value === 'ask'} onClick={() => onChange('ask')}>问一问道</button>
  </div>
}

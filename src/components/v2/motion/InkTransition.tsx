'use client'

import styles from './motion.module.css'

export function InkTransition({ phase, slow, point, onRetry, onDismiss }: {
  phase: 'idle' | 'covering' | 'navigating' | 'revealing' | 'error'
  slow: boolean
  point: { x: number; y: number }
  onRetry: () => void
  onDismiss: () => void
}) {
  const style = { '--ink-x': `${Math.round(point.x * 100)}%`, '--ink-y': `${Math.round(point.y * 100)}%` } as React.CSSProperties
  return <div className={styles.overlay} data-daoflow-ink-state={phase} data-phase={phase} style={style} aria-live="polite" aria-busy={phase !== 'idle' && phase !== 'error'}>
    {phase !== 'idle' && <div className={styles.ink} />}
    {slow && phase !== 'error' && <p className={styles.loading}>页面正在打开…</p>}
    {phase === 'error' && <section className={styles.failure} role="alert"><h2>这次跳转没有完成</h2><p>页面遮罩已解除。你可以重试，或继续当前操作。</p><div><button type="button" onClick={onRetry}>重试</button><button type="button" onClick={onDismiss}>留在当前页</button></div></section>}
  </div>
}

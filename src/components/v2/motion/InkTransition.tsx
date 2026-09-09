'use client'

import { useEffect, useRef } from 'react'
import styles from './motion.module.css'

export const INK_COVER_MS = 400
export const INK_REVEAL_MS = 480

// Analytic contours: bounded canvas work, no full-screen pixel noise or WebGL.
function contour(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, seed: number) {
  ctx.beginPath()
  for (let i = 0; i <= 160; i++) {
    const angle = i / 160 * Math.PI * 2
    const edge = 1 + .095 * Math.sin(angle * 7 + seed) + .048 * Math.sin(angle * 17 - seed) + .022 * Math.sin(angle * 37 + seed * 2)
    const px = x + Math.cos(angle) * radius * edge
    const py = y + Math.sin(angle) * radius * edge
    if (!i) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
}

export function InkTransition({ phase, slow, point, destination, onRetry, onDismiss }: {
  phase: 'idle' | 'covering' | 'navigating' | 'revealing' | 'error'
  slow: boolean
  point: { x: number; y: number }
  destination: string
  onRetry: () => void
  onDismiss: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || phase === 'idle' || phase === 'error') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return // CSS paper fallback remains visible.
    canvas.dataset.ready = 'true'
    const scale = Math.min(1, 1440 / window.innerWidth)
    const width = canvas.width = Math.round(window.innerWidth * scale)
    const height = canvas.height = Math.round(window.innerHeight * scale)
    const x = Math.max(.12, Math.min(.88, point.x)) * width
    const y = Math.max(.12, Math.min(.88, point.y)) * height
    const reach = Math.hypot(width, height) * 1.32
    let frame = 0
    const start = performance.now()
    const paint = (now: number) => {
      const reveal = phase === 'revealing'
      const progress = phase === 'navigating' ? 1 : Math.min(1, (now - start) / (reveal ? INK_REVEAL_MS : INK_COVER_MS))
      const spread = 1 - Math.pow(1 - progress, 2)
      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'
      if (reveal) { ctx.fillStyle = '#203d3c'; ctx.fillRect(0, 0, width, height) }
      else {
        // Separate watery halos arrive before the dense pigment core.
        for (const [factor, color] of [[1.15, 'rgba(95,128,116,.18)'], [1.07, 'rgba(58,98,91,.34)'], [1, '#203d3c']] as const) {
          ctx.fillStyle = color
          contour(ctx, x, y, reach * spread * factor, 1.7)
        }
      }
      // Mist-grey mountain ridges and dry-brush specks stay inside the pigment.
      ctx.globalCompositeOperation = 'source-atop'
      for (let layer = 0; layer < 3; layer++) {
        ctx.fillStyle = `rgba(153,173,150,${.055 + layer * .022})`
        ctx.beginPath(); ctx.moveTo(0, height)
        for (let i = 0; i <= 80; i++) {
          const px = i / 80 * width
          const ridge = height * (.53 + layer * .14) + Math.sin(i * .08 + layer * 2) * height * .12 + Math.sin(i * .31 + layer) * height * .024
          ctx.lineTo(px, ridge)
        }
        ctx.lineTo(width, height); ctx.closePath(); ctx.fill()
      }
      ctx.fillStyle = 'rgba(228,219,186,.10)'
      for (let i = 0; i < 200; i++) ctx.fillRect((i * 173.31) % width, (i * 97.71) % height, 1.2, .6)
      if (reveal) {
        // Open a NEW window through the ink instead of rewinding the cover.
        ctx.globalCompositeOperation = 'destination-out'
        for (const [factor, alpha] of [[1.1, .2], [1.04, .4], [1, 1]]) {
          ctx.fillStyle = `rgba(0,0,0,${alpha})`
          contour(ctx, width * (1 - Math.max(.25, Math.min(.75, point.x))), height * .48, reach * spread * factor, 3.9)
        }
      }
      ctx.globalCompositeOperation = 'source-over'
      if (progress < 1) frame = requestAnimationFrame(paint)
    }
    paint(start)
    return () => cancelAnimationFrame(frame)
  }, [phase, point.x, point.y])

  return <div className={styles.overlay} data-daoflow-ink-state={phase} data-phase={phase} aria-live="polite" aria-busy={phase !== 'idle' && phase !== 'error'}>
    {phase !== 'idle' && phase !== 'error' && <>
      <canvas ref={canvasRef} className={styles.inkCanvas} aria-hidden="true" />
      <div className={styles.destination} aria-hidden="true"><span>山 水 之 间</span><strong>{destination}</strong><i>道</i></div>
    </>}
    {slow && phase !== 'error' && <p className={styles.loading}>页面正在打开…</p>}
    {phase === 'error' && <section className={styles.failure} role="alert"><h2>这次跳转没有完成</h2><p>页面遮罩已解除。你可以重试，或继续当前操作。</p><div><button type="button" onClick={onRetry}>重试</button><button type="button" onClick={onDismiss}>留在当前页</button></div></section>}
  </div>
}

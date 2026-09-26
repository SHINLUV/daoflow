import { waitUntil } from '@vercel/functions'
import { runConfiguredAskWorkerOnce, workerIdentifier } from './runtime'

/**
 * Vercel has no persistent worker process. Keep the durable database queue, run
 * one lease-fenced tick after enqueue, and let the secured cron route recover a
 * job if this function is interrupted before completion.
 */
export function scheduleVercelAskWorker(): boolean {
  if (process.env.VERCEL !== '1') return false
  waitUntil(
    runConfiguredAskWorkerOnce(workerIdentifier()).catch(() => {
      console.error('vercel_ask_worker_failed')
    }),
  )
  return true
}

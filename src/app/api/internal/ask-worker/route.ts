import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { hasAskWorkerConfiguration, runConfiguredAskWorkerOnce, workerIdentifier } from '@/lib/ask-worker/runtime'
import { runtimeEnv } from '../../../../lib/runtime-env'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const secret = runtimeEnv('DAOFLOW_ASK_WORKER_TOKEN')
  if (!secret || secret.length < 32 || !hasAskWorkerConfiguration()) {
    return NextResponse.json({ error: { code: 'ASK_WORKER_UNAVAILABLE', message: '问道 worker 尚未配置。' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  const supplied = request.headers.get('x-daoflow-worker-token')
  if (!supplied || !sameSecret(supplied, secret)) {
    return NextResponse.json({ error: { code: 'ASK_WORKER_UNAUTHORIZED', message: 'worker 凭据无效。' } }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const result = await runConfiguredAskWorkerOnce(workerIdentifier())
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store', 'X-DaoFlow-Worker-Result': result.kind } })
  } catch {
    return NextResponse.json({ error: { code: 'ASK_WORKER_FAILED', message: '问道 worker 本轮未完成。' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

function sameSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

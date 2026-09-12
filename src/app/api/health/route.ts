import { NextResponse } from 'next/server'
import { runtimeEnv } from '../../../lib/runtime-env'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      release: runtimeEnv('DAOFLOW_RELEASE') ?? 'development',
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    },
  )
}

import { type NextRequest } from 'next/server'
import { HallInputError, parseUuid } from '@/lib/hall/contracts'
import { hallError, hallJson, inputError, requestId } from '@/lib/hall/http'
import { getHallPreview, hallServiceHttpError } from '@/lib/hall/service'

export async function GET(request: NextRequest) {
  const id = requestId()
  try {
    const rawSessionId = request.nextUrl.searchParams.get('sessionId')
    if (rawSessionId === null) throw new HallInputError('sessionId 无效。')
    const sessionId = parseUuid(rawSessionId, 'sessionId')
    return hallJson({ preview: await getHallPreview(sessionId) })
  } catch (error) {
    return hallError(error instanceof Error && error.name === 'HallInputError' ? inputError(error) : hallServiceHttpError(error), id)
  }
}

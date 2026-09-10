import { type NextRequest } from 'next/server'
import { hallError, hallJson, inputError, requestId } from '@/lib/hall/http'
import { parseHallListQuery } from '@/lib/hall/contracts'
import { hallServiceHttpError, listPublicHall } from '@/lib/hall/service'

export async function GET(request: NextRequest) {
  const id = requestId()
  try {
    const page = await listPublicHall(parseHallListQuery(request.nextUrl.searchParams))
    return hallJson(page)
  } catch (error) {
    return hallError(error instanceof Error && error.name === 'HallInputError' ? inputError(error) : hallServiceHttpError(error), id)
  }
}

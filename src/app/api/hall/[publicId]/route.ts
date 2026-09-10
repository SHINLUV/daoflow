import { type NextRequest } from 'next/server'
import { parseUuid } from '@/lib/hall/contracts'
import { hallError, hallJson, inputError, requestId } from '@/lib/hall/http'
import { getPublicHall, hallServiceHttpError } from '@/lib/hall/service'

export async function GET(_request: NextRequest, { params }: { params: { publicId: string } }) {
  const id = requestId()
  try {
    return hallJson({ publication: await getPublicHall(parseUuid(params.publicId, 'publicId')) })
  } catch (error) {
    return hallError(error instanceof Error && error.name === 'HallInputError' ? inputError(error) : hallServiceHttpError(error), id)
  }
}

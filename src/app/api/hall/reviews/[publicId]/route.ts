import { type NextRequest } from 'next/server'
import { parseReviewInput, parseUuid } from '@/lib/hall/contracts'
import { hallError, hallJson, inputError, readJson, requestId, requireHallMutationProtection } from '@/lib/hall/http'
import { hallServiceHttpError, reviewHallPublication } from '@/lib/hall/service'

export async function POST(request: NextRequest, { params }: { params: { publicId: string } }) {
  const id = requestId()
  const protectionError = requireHallMutationProtection(request)
  if (protectionError) return hallError(protectionError, id)
  try {
    const publication = await reviewHallPublication(parseUuid(params.publicId, 'publicId'), parseReviewInput(await readJson(request)))
    return hallJson({ publication })
  } catch (error) {
    return hallError(error instanceof Error && error.name === 'HallInputError' ? inputError(error) : hallServiceHttpError(error), id)
  }
}

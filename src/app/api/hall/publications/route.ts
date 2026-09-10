import { type NextRequest } from 'next/server'
import { parsePublishInput } from '@/lib/hall/contracts'
import { hallError, hallJson, inputError, readJson, requestId, requireHallMutationProtection } from '@/lib/hall/http'
import { createHallPublication, hallServiceHttpError } from '@/lib/hall/service'

export async function POST(request: NextRequest) {
  const id = requestId()
  const protectionError = requireHallMutationProtection(request)
  if (protectionError) return hallError(protectionError, id)
  try {
    const publication = await createHallPublication(parsePublishInput(await readJson(request)))
    return hallJson({ publication }, { status: 202 })
  } catch (error) {
    return hallError(error instanceof Error && error.name === 'HallInputError' ? inputError(error) : hallServiceHttpError(error), id)
  }
}

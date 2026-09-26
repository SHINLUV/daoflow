import { type NextRequest } from 'next/server'
import { parseUuid, parseWithdrawInput } from '@/lib/hall/contracts'
import { hallError, hallJson, inputError, readJson, requestId, requireHallMutationProtection } from '@/lib/hall/http'
import { hallServiceHttpError, withdrawHallPublication } from '@/lib/hall/service'

export async function POST(request: NextRequest, props: { params: Promise<{ publicId: string }> }) {
  const params = await props.params;
  const id = requestId()
  const protectionError = requireHallMutationProtection(request)
  if (protectionError) return hallError(protectionError, id)
  try {
    const publication = await withdrawHallPublication(parseUuid(params.publicId, 'publicId'), parseWithdrawInput(await readJson(request)))
    return hallJson({ publication })
  } catch (error) {
    return hallError(error instanceof Error && error.name === 'HallInputError' ? inputError(error) : hallServiceHttpError(error), id)
  }
}

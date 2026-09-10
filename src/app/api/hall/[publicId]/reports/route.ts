import { type NextRequest } from 'next/server'
import { parseReportInput, parseUuid } from '@/lib/hall/contracts'
import { hallError, hallJson, inputError, readJson, requestId, requireHallMutationProtection } from '@/lib/hall/http'
import { hallServiceHttpError, reportHallPublication } from '@/lib/hall/service'

export async function POST(request: NextRequest, { params }: { params: { publicId: string } }) {
  const id = requestId()
  const protectionError = requireHallMutationProtection(request)
  if (protectionError) return hallError(protectionError, id)
  try {
    await reportHallPublication(parseUuid(params.publicId, 'publicId'), parseReportInput(await readJson(request)))
    return hallJson({ accepted: true }, { status: 202 })
  } catch (error) {
    return hallError(error instanceof Error && error.name === 'HallInputError' ? inputError(error) : hallServiceHttpError(error), id)
  }
}

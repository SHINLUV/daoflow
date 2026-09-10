import { hallError, hallJson, requestId } from '@/lib/hall/http'
import { hallServiceHttpError, listMyHallPublications } from '@/lib/hall/service'

export async function GET() {
  const id = requestId()
  try {
    return hallJson({ publications: await listMyHallPublications() })
  } catch (error) {
    return hallError(hallServiceHttpError(error), id)
  }
}

export function getSupabaseCookieName(url: string | undefined) {
  try {
    const projectRef = new URL(url ?? '').hostname.split('.')[0]
    return projectRef ? `sb-${projectRef}-auth-token` : undefined
  } catch {
    return undefined
  }
}

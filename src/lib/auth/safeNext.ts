/** Only accept an in-app absolute path for auth callback navigation. */
export function safeNext(path: string | null): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return '/journal'
  }

  return path
}

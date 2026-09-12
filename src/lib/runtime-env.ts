/**
 * Read server runtime configuration without exposing a `process.env` member
 * access to Next's build-time DefinePlugin. Local standalone secrets are
 * intentionally supplied after the image/build has been produced. Edge lacks
 * Node's process object, so it returns undefined and callers fail closed.
 */
type ProcessLike = { env?: Record<string, string | undefined> }

export function runtimeEnv(name: string): string | undefined {
  const runtimeProcess = (globalThis as typeof globalThis & { process?: ProcessLike })['process']
  return runtimeProcess?.env?.[name]
}

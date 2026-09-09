import { headers } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import type { AskRequestInput, AskResultSnapshot, ClaimedAskRequest } from '@/lib/journal/ask-requests'
import { toSnapshot } from '@/lib/journal/ask-requests'

// Importing next/headers poisons this route-internal module for Client Components.
// Keep the service-role key and every privileged RPC call on the server graph.
void headers

class AskRequestRpcError extends Error {
  constructor(message: string, readonly code?: string, details?: string | null) {
    super([message, code, details].filter(Boolean).join(' '))
    this.name = 'AskRequestRpcError'
  }
}

export function hasAskServiceConfiguration(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function service() {
  if (!hasAskServiceConfiguration()) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function claimAskRequest(userId: string, input: Required<AskRequestInput>): Promise<ClaimedAskRequest | null> {
  const client = service()
  if (!client) return null
  const { data, error } = await client.rpc('claim_ask_request', {
    p_user_id: userId,
    p_request_id: input.requestId,
    p_question: input.question,
    p_source_entry_id: input.sourceEntryId,
    p_volume_id: input.volumeId,
  })
  if (error) throw new AskRequestRpcError(error.message, error.code, error.details)
  return (data?.[0] ?? null) as ClaimedAskRequest | null
}

export async function completeAskRequest(userId: string, claimed: ClaimedAskRequest, result: AskResultSnapshot) {
  const client = service()
  if (!client || !claimed.claim_token) return null
  const { data, error } = await client.rpc('complete_ask_request', {
    p_user_id: userId,
    p_request_id: claimed.request_id,
    p_claim_token: claimed.claim_token,
    p_generation: claimed.generation,
    p_result: toSnapshot(result),
  })
  if (error) throw new AskRequestRpcError(error.message, error.code, error.details)
  return data as { state: string; result_json: AskResultSnapshot | null; session_id: string | null } | null
}

export async function saveAskResult(userId: string, requestId: string) {
  const client = service()
  if (!client) return null
  const { data, error } = await client.rpc('save_ask_result', { p_user_id: userId, p_request_id: requestId })
  if (error) throw new AskRequestRpcError(error.message, error.code, error.details)
  return data as { state: string; result_json: AskResultSnapshot | null; session_id: string | null } | null
}

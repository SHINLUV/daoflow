# AH-P0 Runtime Gate Remediation Verification

Date: 2026-09-11  
Candidate: `6e21b179bc6bf0a0560618df2df9fd6e1a365166` on `codex/auth-hall-rag-runtime-gates`

## Scope and safety boundary

This evidence covers only local code, the local Supabase container, and a loopback standalone server. No production deployment, remote migration, real user sign-in, real Agnes request, service-role business proof, or business UAT was performed. Existing water-ink styling and local private data were not reset or deleted.

## Forward database remediation

- Created and applied `supabase/migrations/20260911053348_hall_execute_and_published_cursor.sql`; historical migrations `001`–`015` were not edited.
- A local custom-format database backup was created before application. The runtime fixture transaction was rolled back; `prompt_version = 'runtime-gate'` publication count was verified as `0` afterward.
- `npx supabase migration list --local` showed `001`–`015` and `20260911053348` aligned.
- Under the local `anon` role, the following direct execution checks were false: `require_hall_user`, `require_hall_reviewer`, and `withdraw_hall_for_deleted_session`. `hall_list_publications` execution remained true for the intended anonymous read entry point.
- A rolled-back three-publication synthetic feed test with limit `2` returned `2` then `1` distinct public IDs, a non-null first cursor, and a null terminal cursor. This confirms the cursor is based on the last returned published item and does not skip the probe row.

## Local engineering verification

| Check | Result |
| --- | --- |
| `npm test` | PASS: 28 files; 156 executed tests passed; 14 explicitly gated E2E cases skipped and are not counted as feature proof. |
| `npm run lint` | PASS: no warnings or errors. |
| `npx tsc --noEmit` | PASS. |
| `scripts/local-session.ps1 -Action Build` | PASS: optimized Next.js build completed. |
| Loopback standalone `GET /ask` | PASS: HTTP 200. |
| Referenced JavaScript assets from `/ask` | PASS: 11 found and all returned HTTP 200 after the launcher prepared `.next/static`. |
| Local browser accessibility tree | PASS (limited): the visible `ask-question` text area, live `0 /500` count, and disabled empty-state submit button were present after a fresh standalone reload. |

The default Playwright suite was started more than once but did not yield a captured final exit code through this session's runner. It is therefore **NOT_ACCEPTED** as E2E evidence. Its existing gated cases remain blocked rather than passed.

## Fixed local defects

- Hall internal helper functions no longer inherit `PUBLIC EXECUTE`; public read RPC grants remain explicit.
- Hall feed ordering uses `published_at` plus public stable ID and a last-returned cursor.
- Hall RPC input/idempotency errors map to client-safe HTTP outcomes; hall JSON responses are no-store/noindex.
- Agnes attempt diagnostics preserve a valid upstream `status` when `statusCode` is malformed; worker test asserts heartbeat precedes completion and save.
- The local launcher treats expected optional Supabase-service diagnostics as non-fatal, launches the standalone server, and copies generated static/public assets before serving.

## Remaining non-negotiable gates

This evidence does not prove real email/OTP/MFA/BFF authentication, two-user JWT/RLS isolation, trusted proxy/attestation, approved corpus and citation quality, live Agnes behavior, durable worker recovery, Hall role workflows, attack/quality suites, production deployment, or business UAT. See the independent R3 report at `docs/redesign-v2/reviews/ah-p0-runtime-gates-independent-acceptance-r3.md` for the binding acceptance decision.

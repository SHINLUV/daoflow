# Local standalone and Caddy evidence (continuation)

Date: 2026-09-13

## Verified locally

- A clean `scripts/local-session.ps1 -Action Build` produced `.next/BUILD_ID`
  and `.next/standalone/server.js` after all candidate changes.
- Full engineering suite: 35 test files passed; 194 tests passed and 14
  explicitly gated tests skipped. Type checking, scoped ESLint, and
  `git diff --check` passed.
- The standalone artifact retains dynamic runtime configuration key references
  behind the server-only `globalThis['process']` accessor; no secret value was
  read or recorded.
- A new local-only Caddy container bound to `127.0.0.1:3210` was started with
  process-only runtime configuration. Its one-shot upstream header probe
  confirmed that Caddy injected attestation and client-IP headers and replaced
  client-supplied forwarded host/proto values. The probe did not record any
  secret value.
- Through that Caddy ingress, an unauthenticated sign-out request passed the
  trusted forwarded-origin and CSRF boundary and reached `401 AUTH_REQUIRED`.
- A synthetic local account registration through the same ingress reached the
  real BFF/Auth path and returned `202`.

## Not accepted as complete

- No recorded email-confirmation callback, dual-account browser session
  isolation, password-recovery browser ceremony, or authenticated RLS
  persistence proof exists yet. The local inbox query did not yield a
  consumable confirmation callback in this run.
- Corpus approval remains pending with zero approved chunks; no classical RAG
  answer may be accepted from that state.
- No real Agnes answer, worker lease completion, or authenticated journal
  persistence was observed in this run.
- This is a loopback-only verification ingress. It is not production Caddy
  deployment evidence.

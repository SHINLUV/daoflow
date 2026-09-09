# Local function API verification

Status: NOT_EXECUTED. Script prepared; local DB and application readiness required.

Run from D:\DAOFLOW using `powershell -File scripts/local-session.ps1 -Action Command -Command node -CommandArguments scripts/verify-local-functions.mjs`. Add `--ask` to the Node arguments for real configured Agnes generation and authenticated ask persistence/concurrency. The default run explicitly records ask NOT_EXECUTED and ends PARTIAL; it does not claim full verification.

The script creates two unique fictional users in loopback local Supabase through Auth admin, signs each in using real password authentication, and uses the installed Supabase SSR cookie adapter to call actual Next.js routes. Service role is used only to initialize Auth fixtures. All business checks use real user JWTs through HTTP or PostgREST; direct ask RPC access is tested as denied. Fixtures remain in the isolated database for independent review. Credentials, cookies and JWTs are not printed.

Assertions cover entry create/read/edit, concurrent CAS and idempotency, search and cursor paging, trash/restore/purge, volume rename/link/archive, preferences, favorite deduplication/annotation/cancel, export snapshots, cross-user reads/writes/links, direct DML denial on all six private tables. Optional ask run verifies actual Agnes, concurrent requests, exactly one stored linked session, idempotent retry/save, and cross-user isolation.

Source audit found migration 005 references `journal_entries(user_id,id)` but migration 003 lacks its required unique constraint. Reported to parent; no migration or product changes made by this verifier.

This is API and real dependency verification, not browser E2E, independent acceptance or business UAT. JSON stdout includes commit, timestamp, each exact observed assertion and explicit partial/failure status. Bind executed output to the source commit and note any working-tree modifications separately.

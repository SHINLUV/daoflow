# Local database environment

Status: PAUSED_BY_USER (2026-09-10, Asia/Shanghai). This is local environment evidence, not production or business acceptance.

- Workspace: `D:\DAOFLOW`; Supabase project ID: `DAOFLOW`.
- Docker Desktop Linux engine started; Docker server 29.5.3 verified. Existing unrelated containers followed their own restart policies automatically; none was manually stopped, removed, or reconfigured.
- Before first start, no Supabase container or volume existed. No reset, volume deletion, remote linking, remote migration, or production operation was performed.
- Supabase CLI 2.117.0 verified. Absolute cached executable: `D:\开发缓存\npm\_npx\6f1b058a4d9555af\node_modules\@supabase\cli-windows-x64\bin\supabase.exe`.
- CLI `--help`, `start --help`, `status --help`, and `migration list --help` inspected before usage.
- First `npx --yes supabase@2.117.0 start` downloaded some image layers. On the user's handoff request, root verified and stopped only that CLI process (PID 36624). No Supabase containers were running at the stop check. Cached layers remain; migrations, seeding and authentication acceptance are NOT_EXECUTED. Recheck before resuming.

Configured endpoints (not yet verified live): API `http://127.0.0.1:54321`; PostgreSQL port 54322; Studio `http://127.0.0.1:54323`; test mail UI `http://127.0.0.1:54324`.

Credentials must be obtained at runtime with `supabase status -o json` and assigned to process environment without printing or committing the result. Never copy service credentials into public environment variables or browser bundles.

Official references consulted: [Local development](https://supabase.com/docs/guides/local-development/cli/getting-started), [Changelog](https://supabase.com/changelog), [Data API security](https://supabase.com/docs/guides/api/securing-your-api). Current documentation requires Docker and distinguishes table grants from row security.

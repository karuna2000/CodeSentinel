# AGENTS.md

## Project

Next.js 16 App Router app (TypeScript 5) — AI-powered repository intelligence engine: GitHub integration → AST/symbol extraction → repository graph → context planner (hybrid retrieval + ranking + token budgeting) → LLM review + wiki/diagram generation. LLM: NVIDIA NIM (`meta/llama-3.2-11b-vision-instruct` primary, `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning` fallback — the account's only provisioned models; the former `minimaxai/*` models hit EOL 2026-09-09) via Vercel AI SDK v6. Auth: NextAuth v4 (GitHub OAuth, JWT). Styling: Tailwind v4 (CSS-based config, no `tailwind.config.ts` content).

### Vision & Roadmap

Repository Intelligence Engine (see `PLAN.md` for full spec):
- **M1 — Repository Index**: GitHub OAuth, repo browser, file tree, incremental sync
- **M2 — Code Intelligence**: Tree-sitter AST parsing, symbol extraction, repository graph (nodes: file/function/class, edges: imports/calls/inherits)
- **M3 — Context Engine** (core differentiator): Intent detection, hybrid retrieval (graph + BM25 + symbols + embeddings), ranking engine, token budget manager
- **M4 — AI Review**: Prompt builder from context, wire to existing reasoning engines, streaming + conversation
- **M5 — Repository Memory**: Repo/file summaries, review history, symbol usage tracking

The `src/stubs/` directories (`database/`, `entities/`, `server/`, `services/`, `scripts/`) are placeholders for the planned backend evolution.

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run lint         # ESLint 9 flat config (must report 0 problems)
npm run typecheck    # tsc --noEmit (must be 0 errors)
npm run test         # vitest run (unit suite, excludes src/evals)
npm run test:watch   # vitest (watch mode)
npm run test:e2e     # Playwright smoke tests (DB-free, dummy GitHub creds)
npm run eval         # src/evals/** LLM+DB integrations (needs live NVIDIA_API_KEY + local DB)
npm run eval:watch   # evals, watch mode

# Database
npm run db:generate        # Regenerate Prisma client
npm run db:push            # Push schema changes to DB (dev only, no migration)
npm run db:migrate         # Deploy pending migrations to production
npm run db:migrate:dev     # Create + apply migration in dev (checks into prisma/migrations/)
npm run db:status          # Show migration status
```

**Run evals early and often.** `src/evals/**` is the only gate that exercises real retriever/ranker prompt behavior end-to-end (needs a live `NVIDIA_API_KEY` + local DB). Run `npm run eval` whenever retrieval, ranking, budget, or prompt construction changes — not just at milestone end — since typecheck/unit/e2e can pass while retrieval quality silently regresses. Set `EVAL_REPO_ID=<graph_node repo id>` to choose the fixture (a repo actually indexed in the local DB, e.g. `b553270d-…`); the retrieval eval resolves expected nodes from the fixture's own symbol names and auto-skips cases the repo can't answer. Chat/wiki evals call NVIDIA directly — they will 401 until `.env.local` holds a valid key. Vitest v4 does not autoload `.env.local` (only plain `NVIDIA_API_KEY`/`EVAL_REPO_ID` exports), but the app itself loads it via Next.

CI (`.github/workflows/ci.yml`): `typecheck` + `test` + `build` are hard gates. `lint-changed` lints only files changed in the event (no new lint errors). Full-repo `lint-report` and `e2e` jobs run with `continue-on-error: true` (non-blocking) as a safety net — `npm run lint` is clean repo-wide (0 problems) and the smoke suite is best-effort.

## Architecture

Single-package app. Path alias: `@/*` → `./src/*`.

**Main flow:** User links GitHub repo → repo/indexer syncs file tree → context engine retrieves relevant symbols/snippets → LLM streams structured review (or wiki/diagram generation runs as background job).

Key entrypoints:
- `src/app/api/github/repos/route.ts` — list + create repos
- `src/app/api/github/repos/[repoId]/` — wiki, chat, sync, webhook
- `src/app/api/jobs/run` — cron-triggered job worker drain
- `src/server/workers/wiki-worker.ts` — background wiki generation
- `src/features/context-engine/` — hybrid retrieval + token budgeting
- `src/features/wiki/` — wiki services, generation API, dashboard page
- `src/middleware.ts` — Edge auth + rate limiting

## Gotchas

- **Rate limiting is global when `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set.** It uses `@upstash/ratelimit` (sliding window) which works on Edge + Node. Without those env vars it falls back to a per-instance in-memory store (dev/local); `checkRateLimit` is now async and must be awaited. Buckets: `auth:<ip>`, `chat:<userId>`, `query:<userId>`, `evidence:<userId>` (120/min), `delete-batch:<userId>` (10/min), `wiki:<userId>`, `wiki-promote:<userId>`, `wiki-edit:<userId>`.
- **Wiki/diagram generation runs as background jobs.** `POST …/wiki/generate` enqueues a `GenerationJob` and returns `{ jobId }` fast (202); clients poll `GET …/wiki/generate/<jobId>` every ~2s. Work is done by `src/server/workers/wiki-worker.ts` (atomic claim via conditional `updateMany`, stale-RUNNING recovery after 30 min), driven either by the in-process `setInterval` worker (long-lived `next start`/`next dev`) or by POST `/api/jobs/run` from a cron (serverless). Duplicate per-repo jobs are deduped in `src/server/jobs/wiki-jobs.ts`. cron secret: `JOBS_RUN_SECRET` (dev fallback allows no-secret access; production without it returns 401). **Generated artifacts are commit-stamped**: `WikiPage.commit_sha`/`Diagram.commit_sha` are set from `Repository.commit_sha` at generation time, and `getDocStaleness` (`src/features/wiki/services/doc-staleness.ts`) compares them — anything behind the current index is stale (`stalePages`/`staleDiagrams` counts surfaced by both wiki GET routes, plus a stale banner + per-page badge in the UI). Stale docs are flagged, never silently replaced.
- **API max duration is 60s (default) / 300s on `/api/jobs/run`.** The wiki generate route no longer needs the 120s override because generation happens in the worker.
- **`streamText`/`streamObject` return synchronously in SDK v6** — a `StreamTextResult` object with `.textStream`, `.usage` (a `PromiseLike`), and `.toTextStreamResponse()`. Don't `await` the call itself and don't type it as `Promise<…>`. Every LLM call goes through `withResilience` (fallback models + exponential backoff in `src/lib/llm/resilience.ts`); the repo-chat answer stream uses it too — never hand-roll model-array retry loops. Because `streamText` is lazy, provider failures can surface **mid-stream after the 200 is sent**; the repo-chat route wraps `result.textStream` in a `ReadableStream` that appends a `[__STREAM_ERROR__]<msg>` sentinel on error, and the client (`RepositoryChatUI`) strips it and shows a toast — partial output is preserved, never a silent empty 200.
- **LLM usage is metered per user per day.** Every LLM call (chat, repo-chat intent detection + answer stream, wiki page summaries) is recorded to `llm_usage` via `src/lib/llm/metering.ts`. `LLM_BUDGET_DAILY_TOKENS` caps a user's daily input+output tokens; when exceeded the LLM routes return 429 (chat), `POST …/wiki/generate` refuses to enqueue, and the wiki worker fails a still-queued job via a pre-run `checkUsageBudget` gate in `runWikiJob` (`src/server/workers/wiki-worker.ts`). Streaming usage is recorded fire-and-forget via `trackStreamUsage(result.usage, …)` — never block the response or await usage before returning the stream. Record on success only, never fail a request when metering breaks.
- **Repo removal** (`DELETE /api/github/repos/[repoId]`, owner-only; two-step "Remove → Confirm?" button in the repo browser) cascades files/graph/wiki/diagrams and explicitly deletes `generation_jobs`. `llm_usage` rows are **not** removed — deleting them would let a user reset their daily token meter by removing repos, so usage history is preserved as a ledger.
- **Auth is GitHub OAuth.** `src/lib/auth.ts` uses `GithubProvider`; the sign-in page renders a "Continue with GitHub" button (`GithubSignInButton`). Sign-out is handled client-side by `UserAvatar` (`signOut({ callbackUrl: '/auth/signin' })`).
- **Empty stubs are intentional.** Many directories (`database/`, `entities/`, `server/`, `services/`, `shared/`, `workflows/`, all `providers/`, most `stores/`, most `config/`, all `scripts/`) are scaffolded Feature-Sliced placeholders. Don't fill them without discussion.
- **`PUBLIC_PATHS` is empty.** Every non-auth path requires authentication via middleware.
- **Hybrid retrieval uses RRF fusion + weighted graph traversal.** `retrieveContext` (`src/features/context-engine/services/hybrid-retriever.ts`) fuses keyword (weighted Postgres FTS `ts_rank_cd`) and semantic (pgvector cosine) ranked lists via Reciprocal Rank Fusion (k=60, 10 hits each → top 15 seeds). It then traverses the graph: hop 1 over all meaningful edge types (IMPORTS=3, CALLS=2, INHERITS=2, READS_STORE=2, FETCHES_ROUTE=1), hop 2 IMPORTS-only with 0.5 decay from strong neighbors, promoting the top 8 neighbors. Hop 1 is capped at 200 edges (`MAX_TRAVERSAL_EDGES`, deterministic `type, id` order) `CONTAINS` edges are excluded from both scoring and the relationships returned to the LLM (containment is implicit via `node.file_id`); only relationships between nodes in the final ≤20-node list are emitted. Each retrieved node also carries its resolved `filePath` (via `file_id` → `files.path`) for evidence.
- **Grounded evidence citations.** `formatContextString` assigns every retrieved node a stable `[E1]..[En]` tag and emits an `EVIDENCE INDEX` mapping tag → `file:line`. The repo-chat route returns the same mapping as a structured `x-citations` header (`{id,label,filePath,startLine,endLine}`) so the UI renders clickable `file:line` chips; the system prompt instructs the model to cite `[E*]` tags inline. `buildEvidenceIndex` (`src/features/context-engine/services/budget-manager.ts`) is the single source of truth for the tag ordering — both the prompt and the header use it.
- **The legacy intent path is gone.** `src/features/context-engine/services/intent-detector.ts` (dead duplicate with a hardcoded `meta/llama3-70b-instruct` model) was deleted; both `/chat` and `/query` use `withResilience` + `generateObject` for intent detection with metering.
- **Repository indexing is diff-based, not delete-and-rebuild.** `indexRepository` compares file content SHAs to detect new/changed/removed files and only re-extracts symbols from changed files (`src/features/github/indexer/github-client.ts`). Graph nodes include source evidence columns (`code_snippet`, `signature`, `documentation`, `start_byte`, `end_byte`, `content_hash`). Within a changed file, `buildRepositoryGraph` does **symbol-level content_hash gating** via the pure `computeSymbolChanges` helper (unit-tested in `src/tests/integration/indexer.test.ts`): unchanged symbols keep their node id + embedding (inbound edges survive), changed/stale symbols are replaced or deleted, and the FILE node id is reused per path so imports into a changed file persist. Each rebuilt file's previously-sourced edges (`source_node_id` = file node) are cleared and re-inserted so no stale/duplicate edges accumulate. `SymbolNodeRef` uses `type:name` keys, so same-name symbols of different kinds (e.g. a class vs. a function) diff independently; legacy rows with `content_hash = NULL` are treated as changed and re-indexed once. Edge extraction (`src/features/code-intelligence/edge-builder.ts`) covers TS/JS (imports, calls, fetch/route + store hooks) and Python (imports/from-imports, identifier + attribute calls); resolved edges carry `source_line`, `source_file`, and `metadata` (call expression text, import path). CALLS fall back to symbol-node resolution when no file-node match exists. Edge refresh only re-parses *changed* files, so edges into changed/removed symbols are dropped and won't resolve until their source file is also changed (acceptable for typical incremental updates). The HEAD commit SHA is stored on `Repository.commit_sha` for future re-sync.
- **Prisma schema is migration-managed.** Run `npm run db:migrate:dev` to create a new migration; run `npm run db:push` only for quick prototyping. `npx prisma generate` runs automatically on `db:generate` or `db:push`.

## Conventions

- Feature-sliced architecture: `src/features/<domain>/components/`, `hooks/`, `services/`, `utils/`, `__tests__/`
- Tests use Vitest with globals enabled. Setup file at `src/tests/setup/vitest.setup.ts` (suppresses console.error, clears mocks).
- AI SDK v6 API: uses `sendMessage({ text })` not `append()`. Chat transport injects `mode` and `findingContext` into request body.
- CSS variables drive the theme (`--bg: #f5f0e8` warm paper). Tailwind v4 mapped via `@theme inline` in `globals.css`.
- `.env.example` lists required vars: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NVIDIA_API_KEY`.

## Agent Skills

Located in `.agents/skills/`: code-review, security-auditor, test-engineer, Ci-Cd. Reference `.agents/overview.md` and `.agents/architecture.md` for agent orchestration design.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

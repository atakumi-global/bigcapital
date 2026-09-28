# HANDOVER — Bigcapital

**Updated:** 2026-09-28

Current state, battle scars, verified facts and next actions. Read this after
`AGENTS.md`. Plane holds the live state of work (`atakumi` / `BIG`); this file
holds what the next person needs that is not in the tickets.

## State

| Piece | Status |
| --- | --- |
| Monorepo | pnpm + Lerna (independent versioning) |
| Server | `@bigcapital/server` — NestJS API + CLI, multi-tenant (system DB + per-tenant MariaDB), Knex migrations, Objection.js |
| Webapp | `@bigcapital/webapp` — React SPA (Vite, BlueprintJS, Redux, React Router v5) |
| Shared | `@bigcapital/utils`, `pdf-templates`, `email-components`, `sdk-ts` (generated from OpenAPI) |
| Wise feed | Implemented: `modules/Wise`, `modules/BankingWise`, `modules/BankingFeeds` |
| Local services | `docker compose up -d` → MariaDB (3306), Redis (6379), Gotenberg (9000), Garage/S3 (3900) |
| Plane project | Configured 2026-09-28 — `atakumi` / `BIG`, 12 states, 8 labels |

## Deploy battle scars

- **Build before migrate.** `pnpm run build:server` is required before any
  migration CLI command; the server CLI entry is compiled separately.
- **Two migration systems.** System DB and tenant DB have separate migration and
  seed directories and separate CLI commands — never assume one covers the other.
- **One root `.env`.** The server and its CLI resolve the root `.env` regardless
  of CWD; a `packages/server/.env` silently takes precedence if it exists.
- **Only `VITE_`, `REACT_APP_` and `PUBLIC_URL` reach the client.** Anything else
  is invisible to the webapp.
- **Node 18.16.1.** `engines` claims 16/17/18; CONTRIBUTING says 18; use 18.16.1.
- **This is a fork.** `origin` is upstream — pushing there is a mistake, not a
  shortcut.
- **The pre-commit hook runs `npm run format` then `git add -A`.** That stages
  the entire working tree — scratch directories included — and sweeps unrelated
  reformats into your commit (observed: 24 scratch files and 7 unrelated source
  files nearly landed in a docs commit). Stage explicitly and commit with
  `--no-verify`, or fix the hook.
- **commitlint uses `@commitlint/config-lerna-scopes`** — the scope must be an
  existing package name (`server`, `webapp`, …), so a scope like `standard` is
  rejected. Use a package scope or `--no-verify`.

## Verified facts (do not re-derive)

- **Wire format is snake_case.** `SerializeInterceptor` converts inbound
  snake_case → camelCase for DTOs and outbound camelCase → snake_case. The SDK
  request middleware sends snake_case; the response camel-case middleware is
  **disabled by default**.
- **When writing query hooks:** use `useApiFetcher({ enableCamelCaseTransform: true })`
  and work in camelCase. With legacy `apiRequest`, transform manually.
- **DB columns are snake_case**; Objection.js models map to camelCase properties.
  New DTOs use camelCase `@ApiProperty` names.
- **Wise credentials are env-only, one connection per deployment**, and the token
  must be read-only. Sync state lives in `bank_feed_items.sync_state`; first sync
  fetches 90 days (hard cap 469).
- **Playwright selectors use `data-testId`** (capital I). Global setup onboards a
  test user and persists auth to `e2e/.auth/user.json`.
- **Idempotency is app-level** for Wise transactions (no unique index) —
  duplicates are filtered in `WiseUpdateTransactions.filterExistingTransactions`.

## Next actions

1. Align the Plane project's states with the standard if they drift (created with
   all 12 on 2026-09-28 — no action expected).
2. Keep the fork close to upstream deliberately — decide a rebase cadence and
   record it as a work item if it matters.
3. Add a design contract under `design-system/` if we begin diverging from
   BlueprintJS.

## Known gaps

- No root-level CI description in this file; the upstream project ships its own
  workflows — check `.github/workflows/` before relying on one.
- Untracked scratch: `graphify-out/`, `packages/server/graphify-out/`,
  `wise-bank-feed-plan.md`.

## Verification commands

```bash
pnpm run typecheck
pnpm run lint:check        # or `pnpm run lint` to fix
pnpm run format:check
pnpm run build:server      # required before any migration command
cd packages/server && pnpm run test
pnpm run e2e:webapp
```

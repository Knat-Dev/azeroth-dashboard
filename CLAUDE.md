# Azeroth Dashboard

You are an expert in TypeScript, React 19, Next.js 16 (App Router), NestJS 11, Tailwind CSS v4, Turborepo, TypeORM, SQLite (better-sqlite3), and Docker. You are building a server management dashboard for an AzerothCore WoTLK private server. You understand the WoW 3.3.5a data model (accounts, characters, guilds, realms, GM levels) and how AzerothCore's MySQL databases are structured.

## Architecture

```
apps/web   — Next.js 16, React 19, Tailwind v4, Highcharts (port 7790 dev / 7780 prod)
apps/api   — NestJS 11, TypeORM (MySQL for game DBs), better-sqlite3 (dashboard-local data) (port 7791 dev / 7781 prod)
packages/shared  — Pure TS types & constants (WOW_CLASSES, WOW_RACES, WOW_ZONES, GmLevel, etc.)
packages/ui      — Shared UI components
```

## Commands

```bash
pnpm dev          # Start both apps (turbo)
pnpm build        # Build all
pnpm test         # Run tests (Jest in API)
pnpm lint         # ESLint across all packages
pnpm check-types  # TypeScript type checking
```

## Timestamps — IMPORTANT

SQLite stores all timestamps via `datetime('now')` which returns UTC strings **without** a `Z` suffix (e.g. `2025-02-08 15:30:45`). JavaScript's `new Date()` interprets such strings as **local time**, causing every timestamp to appear off by the user's timezone offset.

**How this is handled:**

1. **API client reviver (primary defense):** `apps/web/src/lib/api.ts` has a `timestampReviver` in `JSON.parse` that appends `Z` to all bare datetime strings as they arrive from the API. This means all API data flowing through the `api` client has correct UTC timestamps automatically — new code using `new Date(timestamp)` on API data will just work.

2. **`parseUTC()` helper (explicit fallback):** `apps/web/src/lib/utils.ts` exports `parseUTC(timestamp)` for any case where timestamps don't flow through the API client (e.g. WebSocket messages, direct fetch, or third-party data). Use this instead of `new Date()` when parsing timestamps from any backend source.

**Rules:**
- Never use raw `new Date(someApiTimestamp)` outside of API-client-fetched data
- If adding a new data source (WebSocket, SSE, etc.), make sure timestamps are normalized to include `Z` or use `parseUTC()`
- SQLite queries comparing against `datetime('now')` are correct since both sides are UTC

## Auth

JWT-based via NestJS Passport. `JWT_SECRET` from env. Auth response returns `{ accessToken, user: { id, username, email, gmLevel } }`. GmLevel enum: 0=Player, 1=Moderator, 2=GameMaster, 3=Admin, 4=Console.

## Docker

The API container mounts `/var/run/docker.sock` to manage AzerothCore containers (restart worldserver/authserver). Connects to external `ac-network`. Volumes: `dashboard-data` (SQLite), `dashboard-backups`.

## Databases

- **MySQL** (via TypeORM): AzerothCore's `acore_auth`, `acore_characters`, `acore_world` — read-only for dashboard queries (accounts, characters, guilds, bans)
- **SQLite** (via better-sqlite3): Dashboard-local data at `/data/dashboard.db` (prod) or `./data/dashboard.db` (dev) — events, player_history, settings

## Shared Package

`@repo/shared` is the cross-app type contract. When adding new API endpoints, define request/response types here first. No runtime dependencies — pure TypeScript compiled to `dist/`.

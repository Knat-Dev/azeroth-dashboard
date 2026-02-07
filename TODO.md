# Azeroth Dashboard — Implementation TODO

> Mark each step `[x]` as completed. Do not skip steps. Do not move to next phase until current phase is fully done.

---

## Phase 1: Restructure + Core (Tier 0)

### 1.1 Route Restructure (Frontend)

- [x] Move `(dashboard)/admin/console/page.tsx` → `(dashboard)/console/page.tsx`
- [x] Move `(dashboard)/admin/backups/page.tsx` → `(dashboard)/backups/page.tsx`
- [x] Move `(dashboard)/admin/accounts/page.tsx` → `(dashboard)/accounts/page.tsx`
- [x] Move `(dashboard)/admin/bans/page.tsx` → `(dashboard)/bans/page.tsx`
- [x] Delete `(dashboard)/admin/broadcast/page.tsx` (broadcast moves to dashboard inline)
- [x] Delete `(dashboard)/admin/page.tsx` (old admin overview — dashboard replaces it)
- [x] Delete `(dashboard)/characters/page.tsx` (Tier 3 — remove for now)
- [x] Delete `(dashboard)/characters/[guid]/page.tsx` (Tier 3 — remove for now)
- [x] Delete `(dashboard)/guilds/page.tsx` (Tier 3 — remove for now)
- [x] Delete `(dashboard)/guilds/[id]/page.tsx` (Tier 3 — remove for now)
- [x] Delete `(dashboard)/armory/page.tsx` (Tier 3 — remove for now)
- [x] Delete `(dashboard)/account/page.tsx` (player self-service — remove)
- [x] Delete `(auth)/register/page.tsx` (no public registration)
- [ ] Update `(dashboard)/page.tsx` to be the new ops dashboard (placeholder for now)
- [ ] Verify all deleted routes return 404, no broken imports

### 1.2 Sidebar Navigation

- [x] Rewrite `components/layout/sidebar.tsx` with new nav structure:
  - Operations: Dashboard `/`, Console `/console`, Backups `/backups`
  - Management: Accounts `/accounts`, Bans `/bans`
  - System: Settings `/settings`
- [x] Remove all old nav items (characters, guilds, armory, account, admin section)
- [x] Remove `isAdmin()` check — everything is admin, no conditional sections
- [ ] Verify active state highlighting works on all new paths

### 1.3 Auth Cleanup

- [x] Delete `(auth)/register/page.tsx`
- [x] Remove register route from auth controller if it has one (backend)
- [x] Remove `register` function from `auth-provider.tsx`
- [x] Remove register-related code from `auth.service.ts` (backend) — or keep but don't expose
- [x] Login page: remove "Register" link/button if present
- [x] Verify login still works with GM account (gmlevel >= 3)
- [x] Verify non-GM accounts are rejected at login

### 1.4 SOAP Credentials → Env Vars

- [x] Read current `soap.service.ts` to understand how credentials are used
- [x] Update `soap.service.ts` to use `SOAP_USER`/`SOAP_PASSWORD` from env/config
- [x] Remove per-user credential passing from `admin.controller.ts` `executeCommand`
- [x] Remove `credential-cache.service.ts` if it exists
- [x] Update `app.config.ts` to include `soap.user` and `soap.password` from env
- [x] Update `.env.example` with `SOAP_USER` and `SOAP_PASSWORD` (verify they're there)
- [x] Update `docker-compose.yml` to pass SOAP env vars
- [ ] Test SOAP command from console still works

### 1.5 DockerService (Backend)

- [x] Create `src/modules/docker/docker.service.ts`
- [x] Create `src/modules/docker/docker.module.ts`
- [x] Implement `listContainers()` — GET `/v1.45/containers/json?all=true`
- [x] Implement `inspectContainer(name)` — GET `/v1.45/containers/{name}/json`
- [x] Implement `getContainerState(name)` — returns { state, status, startedAt }
- [x] Implement `restartContainer(name)` — POST `/v1.45/containers/{name}/restart`
- [x] Add allowlist validation (`ac-worldserver`, `ac-authserver`) on all methods
- [x] Migrate existing Docker API code from `logs.service.ts` to use shared DockerService
- [x] Update `logs.service.ts` to inject DockerService instead of raw HTTP calls
- [x] Register DockerModule in `app.module.ts`
- [ ] Test: list containers works
- [ ] Test: restart container works

### 1.6 MonitorService (Backend — Cached Health)

- [x] Create `src/modules/monitor/monitor.service.ts`
- [x] Create `src/modules/monitor/monitor.module.ts`
- [x] Implement single polling loop (setInterval every 5s on module init)
- [x] Poll Docker states for worldserver + authserver
- [x] Poll SOAP connectivity (quick `.server info` call, timeout 3s)
- [x] Poll online player count (`characters WHERE online=1`)
- [x] Store cached health state in memory
- [x] Implement `getHealth()` — returns cached state (no I/O)
- [x] Track previous state for change detection (needed for Phase 2)
- [x] Clean shutdown: clear interval on module destroy
- [x] Register MonitorModule in `app.module.ts` (import DockerModule, inject repos)

### 1.7 Health Endpoint

- [x] Add `GET /api/server/health` to `server.controller.ts`
- [x] Returns: `{ worldserver: { state, status }, authserver: { state, status }, soap: { connected }, players: { online } }`
- [x] Endpoint reads from MonitorService cache (zero I/O per request)
- [x] No auth required? Or require JWT? (Decision: require JWT — admin only dashboard)
- [ ] Test: endpoint returns correct cached data
- [ ] Test: multiple rapid requests don't trigger Docker/SOAP calls

### 1.8 Health Bar Component (Frontend)

- [x] Create `components/layout/health-bar.tsx`
- [x] Poll `GET /api/server/health` every 5 seconds
- [x] Render status for: Worldserver, Authserver, SOAP, Players Online
- [x] Status dot component: green (running), red (stopped), yellow (restarting)
- [x] Green dot has subtle glow `shadow-[0_0_6px_rgba(34,197,94,0.5)]`
- [x] Red dot has subtle glow `shadow-[0_0_6px_rgba(239,68,68,0.5)]`
- [x] Yellow dot pulses (animate-pulse)
- [x] Place in dashboard layout (visible on every page)
- [x] Handle loading state (show dots as gray on initial load)
- [x] Handle error state (API unreachable — show all as unknown/gray)
- [ ] Verify it doesn't re-render entire page on each poll

### 1.9 Restart Controls

- [x] Add `POST /api/admin/restart/:container` to admin controller (backend)
- [x] Validate container name in allowlist
- [x] Call `DockerService.restartContainer(name)`
- [x] Return new container state after restart
- [x] Add restart buttons to dashboard page UI
- [x] Build `ConfirmDialog` component (reusable modal with backdrop blur)
- [x] Restart worldserver button → opens confirm dialog → calls API → shows spinner → updates health bar
- [x] Restart authserver button → same flow
- [x] Restart all button → restarts both sequentially
- [x] Error handling: show toast/alert if restart fails
- [ ] Test: restart actually restarts the Docker container
- [ ] Test: health bar reflects new state after restart

### 1.10 Dashboard Page (Redesign)

- [x] Rewrite `(dashboard)/page.tsx` as ops command center
- [x] Section: Server Health — stat cards for worldserver/authserver/soap/players (reads from health bar data or own poll)
- [x] Section: Quick Actions — restart buttons (worldserver, authserver, restart all)
- [x] Section: Broadcast — inline message form (text input, type selector, send button)
- [x] Move broadcast logic from old broadcast page into dashboard
- [x] Success/error feedback for broadcast (inline alert or toast)
- [x] Clean layout: good spacing, card-based sections, consistent with design system
- [x] Verify page loads fast (no blocking API calls for render)

### 1.11 Final Phase 1 Checks

- [x] Run `pnpm build` in apps/web — no TypeScript errors
- [x] Run `pnpm build` in apps/api — no TypeScript errors
- [ ] Test full flow: login → dashboard → see health → restart → console → backups
- [x] Verify no broken imports from deleted files
- [ ] Verify sidebar navigation works on all routes
- [ ] Verify health bar polls correctly and updates
- [ ] Verify SOAP commands work with env var credentials
- [ ] Verify console page still streams logs correctly
- [ ] Verify backups page still works

---

## Phase 2: Self-Healing (Tier 1)

### 2.1 SQLite Setup

- [x] Add `better-sqlite3` (or `sql.js`) dependency to API
- [x] Create `src/config/sqlite.config.ts` — initialize SQLite DB at `/data/dashboard.db`
- [x] Create events table: `id, timestamp, container, event_type, details, duration_ms`
- [x] Create player_history table: `id, timestamp, count`
- [x] Create settings table: `key, value` (for runtime config)
- [x] Initialize DB on app bootstrap
- [x] Update docker-compose: add `dashboard-data:/data` volume

### 2.2 Event Logging

- [x] Create `src/modules/monitor/event.service.ts`
- [x] Implement `logEvent(container, type, details)` — inserts into SQLite
- [x] Implement `getEvents(limit)` — returns recent events
- [x] Implement `getEventsSince(timestamp)` — for crash loop detection
- [x] Wire into MonitorService: log events on state changes

### 2.3 Crash Detection

- [x] In MonitorService: compare current state with previous state each poll cycle
- [x] Detect: running → exited/dead = crash event
- [x] Detect: exited → running = recovery event
- [x] Log each state change via EventService
- [x] Update cached health to include `lastEvent` info

### 2.4 Auto-Restart

- [x] Read config from env: `AUTO_RESTART_ENABLED`, `COOLDOWN`, `MAX_RETRIES`, `RETRY_INTERVAL`
- [x] On crash detection: if auto-restart enabled, start restart sequence
- [x] Wait cooldown period before first attempt
- [x] Call DockerService.restartContainer()
- [x] If fails: wait retry interval, attempt again (up to max retries)
- [x] Log each attempt as event
- [x] On success: log recovery event with downtime duration
- [x] On final failure: log restart-failed event

### 2.5 Crash Loop Protection

- [x] After each restart, check: how many restarts in last CRASH_LOOP_WINDOW seconds?
- [x] If >= CRASH_LOOP_THRESHOLD: enter crash loop state
- [x] Suspend auto-restart for this container
- [x] Log crash-loop event
- [x] Health state shows CRITICAL (distinct from normal stopped)
- [x] Admin must manually clear crash loop state (via API or restart button)
- [x] Manual restart clears crash loop state

### 2.6 Startup Dependency Awareness

- [x] Before auto-restarting worldserver: check if authserver is running
- [x] If authserver is down: skip worldserver restart, log "dependency not met"
- [x] SOAP degradation: if worldserver running but SOAP fails for 3+ consecutive checks → log degraded event
- [x] Do NOT auto-restart on SOAP degradation (container is running fine)

### 2.7 Webhook Service

- [x] Create `src/modules/webhook/webhook.service.ts`
- [x] Create `src/modules/webhook/webhook.module.ts`
- [x] Read `DISCORD_WEBHOOK_URL` and `WEBHOOK_EVENTS` from config
- [x] Implement `sendNotification(event, severity, message, details)`
- [x] Format as Discord embed: color based on severity, timestamp, fields
- [x] Rate limit: max 1 webhook per event type per 60 seconds
- [x] Async fire-and-forget (don't block monitor loop)
- [x] Handle webhook URL not configured (silently skip)
- [x] Handle webhook delivery failure (log warning, don't crash)
- [x] Wire into MonitorService: fire webhook on state change events
- [x] Wire into BackupService: fire webhook on backup success/failure
- [ ] Test: crash → Discord message received
- [ ] Test: crash loop → CRITICAL Discord message received
- [ ] Test: backup complete → Discord message received

### 2.8 Events API Endpoint

- [x] Add `GET /api/server/events` to server controller
- [x] Query params: `limit` (default 50), `container` (optional filter)
- [x] Returns events from SQLite, newest first
- [x] Requires JWT auth

### 2.9 Settings Page (Frontend)

- [x] Create `(dashboard)/settings/page.tsx`
- [x] Section: Auto-Restart — toggle enabled, cooldown input, max retries, retry interval
- [x] Section: Crash Loop — threshold, window
- [x] Section: Webhooks — Discord URL input, event checkboxes
- [ ] Section: Backups — retention days, cron schedule (already exists in backups page — move or duplicate)
- [x] Backend: `GET /api/admin/settings` — returns current config (from env + SQLite overrides)
- [x] Backend: `PUT /api/admin/settings` — updates runtime config in SQLite
- [x] Runtime config overrides env vars (env = defaults, SQLite = admin overrides)
- [x] Save button with success toast

### 2.10 Restart History on Dashboard

- [x] Add "Recent Events" section to dashboard page
- [x] Fetch `GET /api/server/events?limit=10`
- [x] Render as compact timeline/list: timestamp, container, event type, duration
- [x] Color-code by severity: info (muted), warning (yellow), high (red), critical (pulsing red)
- [ ] Link to full event history if needed

### 2.11 Final Phase 2 Checks

- [ ] Test: stop worldserver container manually → dashboard detects crash → auto-restart fires → container recovers
- [ ] Test: stop worldserver 3x rapidly → crash loop detected → auto-restart suspended → CRITICAL in UI
- [ ] Test: manual restart clears crash loop state
- [ ] Test: stop authserver → worldserver crash → worldserver NOT auto-restarted (dependency)
- [ ] Test: Discord webhook fires for crash, restart, crash-loop events
- [ ] Test: webhook rate limiting works (rapid crashes don't spam)
- [ ] Test: settings page saves and applies config
- [ ] Test: restart history shows on dashboard
- [x] Build passes with no errors

---

## Phase 3: Visibility (Tier 2)

### 3.1 Player Count Recording

- [x] In MonitorService: every 5 minutes, write player count to SQLite player_history table
- [x] `GET /api/server/player-history?range=24h|7d|30d` — returns time series data
- [x] Prune old data: delete records older than 30 days

### 3.2 Online Players Endpoint

- [x] Add `GET /api/server/players` to server controller
- [x] Query: `SELECT guid, name, level, class, race, zone FROM characters WHERE online=1`
- [x] Zone/class/race name mapping via frontend constants (`wow-constants.ts`)
- [x] Return array of player objects

### 3.3 Players Page (Frontend)

- [x] Create `(dashboard)/players/page.tsx`
- [x] Fetch online players from API
- [x] Render as table: Name, Level, Class (with color), Race, Faction, Zone
- [x] Auto-refresh every 30s
- [x] Empty state: "No players online"
- [x] Loading spinner
- [x] Add Players link to sidebar navigation

### 3.4 Player Count Chart

- [x] Add `highcharts` + `highcharts-react-official` dependencies to frontend
- [x] Create `components/dashboard/player-chart.tsx`
- [x] Dashboard page: add player count chart section
- [x] Fetch player history from API
- [x] Render as areaspline chart with time on X axis, count on Y axis
- [x] Highcharts dark theme styling (gold accent, transparent bg)
- [x] Toggle: 24h / 7d / 30d
- [x] Handle no data gracefully

### 3.5 Final Phase 3 Checks

- [ ] Test: player count records over time
- [ ] Test: players page shows online characters
- [ ] Test: chart renders with real data
- [ ] Test: chart handles empty data
- [x] Build passes

---

## Phase 4: Management (Tier 3)

### 4.1 Polish Existing Pages

- [ ] Accounts page: verify it works at new route `/accounts`
- [ ] Bans page: verify it works at new route `/bans`
- [ ] Autobroadcast: decide where it lives (settings? or separate page?)
- [ ] Ensure consistent UI (table headers, spacing, empty states, loading states)

### 4.2 Armory (Future)

- [ ] Character search
- [ ] Character detail page (WoW-native UI: gear, stats)
- [ ] Accessible from Players table as drill-down

### 4.3 Final Polish

- [ ] Responsive design check (sidebar collapse on mobile?)
- [ ] Error boundaries on all pages
- [ ] 401 handling (auto-logout) — already implemented in api.ts
- [ ] Loading states consistent across all pages
- [ ] Empty states consistent with icons across all pages
- [ ] Toast notifications for all mutation actions
- [ ] Docker builds work (`docker compose build`)
- [ ] Full E2E test: fresh clone → env setup → docker compose up → login → full feature walkthrough

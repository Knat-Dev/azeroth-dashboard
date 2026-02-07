# Azeroth Dashboard — Product Requirements Document

## What Is This?

The first real Docker control plane for AzerothCore WoTLK 3.3.5a private servers.

**If the dashboard is never opened, the system still protects the server.**

Not a community portal. Not a player tool. A **reliability layer** for server administrators.

---

## Core Principle

This is a **guardian**, not a dashboard.

The dashboard is the UI. The product is the protection underneath:
- Server crashes → auto-restart kicks in → Discord alert sent → admin sees it later
- No browser needed. No human in the loop. The system heals itself.

The UI exists so admins can *observe and intervene* — not because it's required for the system to work.

---

## Target User

A single person (or small team) running an AzerothCore private server via Docker. They want to:
- Know if the server is alive (in 2 seconds)
- Get alerted when something breaks (without watching a screen)
- Restart services without SSH
- Read live logs when debugging
- Broadcast messages to players
- Take backups before risky changes

---

## Setup

```bash
git clone <repo> azeroth-dashboard
cd azeroth-dashboard
cp .env.example .env    # edit if non-default
docker compose up -d    # done → http://localhost:7780
```

No modifications to the user's AzerothCore docker-compose. Connects via host-exposed ports + Docker socket.

---

## Auth

- Login with WoW GM account (SRP6, same as in-game)
- Only accounts with `gmlevel >= 3` can access the dashboard
- JWT session tokens
- No public registration — admin-only
- SOAP uses dedicated service credentials from `.env` (not per-user)

---

## Architecture Decision: Centralized Monitor

> **Critical:** The backend runs a single monitor loop. Frontend reads cached state. Clients never trigger Docker/SOAP checks directly.

```
┌─────────────────────────────────────────────┐
│  MonitorService (single loop, runs always)  │
│                                             │
│  Every 5s:                                  │
│    - Poll Docker container states           │
│    - Check SOAP connectivity                │
│    - Count online players                   │
│    - Detect state changes → fire events     │
│    - Auto-restart if configured             │
│    - Send webhooks if configured            │
│                                             │
│  Stores: cached health, event history,      │
│          player count snapshots             │
└─────────────────────────────────────────────┘
         │
         ▼
  GET /api/server/health  ← returns cached state (fast, no I/O)
         │
         ▼
  Frontend polls this endpoint every 5s
  Multiple clients = no extra load
```

This is the core of the product. Everything else is UI on top.

---

## Feature Tiers

### Tier 0 — The Core

> If these aren't solid, nothing else matters.

**Priority order: Health → Restart → Console → Broadcast**

#### 1. Server Health Bar (Always Visible)

Persistent status bar at the top of every page. Answers "is my server alive?" in 2 seconds.

| Indicator | Source | State |
|-----------|--------|-------|
| Worldserver | Docker container state | Running / Stopped / Restarting |
| Authserver | Docker container state | Running / Stopped / Restarting |
| SOAP | Test connection via monitor | Connected / Failed |
| Players Online | `characters WHERE online=1` | Count |

**States:** Running (green dot + glow), Stopped (red dot + glow), Restarting (yellow dot, pulsing)

**Implementation:**
- Backend: `GET /api/server/health` — returns cached state from MonitorService (no I/O per request)
- Frontend: Polls every 5s, renders as compact bar in sidebar or top of layout
- Multiple browser tabs = same backend load (cached responses)

#### 2. Restart Controls

Buttons to restart Docker containers via the Docker Engine API.

| Action | Docker API Call |
|--------|----------------|
| Restart Worldserver | `POST /v1.45/containers/ac-worldserver/restart` |
| Restart Authserver | `POST /v1.45/containers/ac-authserver/restart` |
| Restart All | Both sequentially |

**UI:** Buttons on the dashboard page. Each requires a confirmation dialog. Show spinner during restart, health bar updates when container comes back.

**Implementation:**
- Backend: `POST /api/admin/restart/:container` — calls Docker restart API
- Container name must be in allowlist
- Fires `manual-restart` event to event log + webhook

#### 3. Live Console

Already built. Streams Docker container stdout via SSE with ANSI color rendering.

**Requirements (all done):**
- [x] Real-time streaming (SSE)
- [x] ANSI colors (ansi-to-html)
- [x] Auto-scroll with toggle
- [x] Container tabs (Worldserver / Authserver)
- [x] Clear button
- [x] Max line limit (2000)
- [x] SOAP command input
- [x] Only current run logs (Docker `since` param)
- [x] Optimistic UI (no flicker on load)

**Changes needed:**
- SOAP commands use env var credentials instead of per-user auth

#### 4. Broadcast Message

Quick message input to send announcements to online players via SOAP.

**Commands:**
- `.announce <msg>` — chat message to all players
- `.notify <msg>` — on-screen popup to all players

**UI:** Quick-action card on the dashboard page. Text input, type selector, send button. Not a separate page.

---

### Tier 1 — Self-Healing & Reliability

> This is where the product becomes a guardian, not just a dashboard.

**Priority order: Auto-restart → Crash loop protection → Webhooks → Backups**

#### 5. Crash Detection + Auto-Restart

The most important feature after the core UI.

**When a monitored container stops:**
1. MonitorService detects state change (running → exited/dead)
2. Log event with timestamp
3. If auto-restart enabled: wait cooldown, attempt restart
4. If restart fails: retry up to N times
5. Fire webhook at each stage

**Crash Loop Protection (Critical):**
If a container restarts repeatedly (3+ times in 5 minutes):
- **Stop auto-restart** — don't restart endlessly
- Send **CRITICAL** webhook: "Worldserver crash loop detected — auto-restart suspended"
- Show **CRITICAL** state in health bar (distinct from normal "stopped")
- Admin must manually restart or investigate

**Startup Dependency Awareness:**
- If authserver is down → don't auto-restart worldserver (it depends on auth)
- If worldserver is running but SOAP is dead → alert as degraded, don't restart

**Configuration:**
```env
AUTO_RESTART_ENABLED=true
AUTO_RESTART_COOLDOWN=10          # seconds before first restart attempt
AUTO_RESTART_MAX_RETRIES=3        # max consecutive attempts
AUTO_RESTART_RETRY_INTERVAL=30    # seconds between retries
CRASH_LOOP_THRESHOLD=3            # restarts in window = crash loop
CRASH_LOOP_WINDOW=300             # window in seconds (5 min)
```

#### 6. Webhook Notifications (Discord)

Send HTTP POST to a configured webhook URL on events.

**Events:**
| Event | Severity | Message |
|-------|----------|---------|
| Container crashed | High | "Worldserver crashed at {time}" |
| Auto-restart triggered | Info | "Attempting auto-restart of worldserver..." |
| Restart succeeded | Info | "Worldserver restarted successfully (downtime: {duration})" |
| Restart failed | High | "Failed to restart worldserver after {n} attempts" |
| Crash loop detected | Critical | "Crash loop detected — auto-restart suspended" |
| SOAP degraded | Warning | "Worldserver running but SOAP unresponsive" |
| Backup completed | Info | "Backup completed: {filename} ({size})" |
| Backup failed | High | "Backup failed: {error}" |

**Implementation:**
- Discord-compatible embed format (works with Discord, Slack via adapter, generic webhooks)
- Configurable event filter: choose which events to send
- Rate limit: max 1 webhook per event type per 60 seconds (prevent spam during crash loops)

**Configuration:**
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
WEBHOOK_EVENTS=crash,restart,crash-loop,backup-failed
```

#### 7. Backups

Already built. One-click mysqldump with download and scheduled backups.

**Existing features:**
- [x] Manual backup trigger with database selection
- [x] Backup list with size and date
- [x] Download backups
- [x] Delete backups
- [x] Scheduled backups (cron)
- [x] Retention policy

**Enhancement:** Fire webhook on backup success/failure.

---

### Tier 2 — Operational Visibility

#### 8. Online Players List

Table showing currently connected players.

| Column | Source |
|--------|--------|
| Name | `characters.name` |
| Level | `characters.level` |
| Class | `characters.class` (with class color) |
| Race | `characters.race` |
| Zone | `characters.zone` (map to zone name) |

**Implementation:**
- Backend: `GET /api/server/players` — query `characters WHERE online=1`
- Frontend: Simple table, auto-refresh every 30s

#### 9. Player Count Over Time

Simple line chart showing online player count history.

**Views:** Last 24h, Last 7 days, Last 30 days

**Implementation:**
- MonitorService records player count to SQLite every 5 minutes
- `GET /api/server/player-history?range=24h`
- Frontend: Lightweight chart (recharts)

#### 10. Uptime & Restart History

Log of all container state changes.

| Column | Value |
|--------|-------|
| Timestamp | When it happened |
| Container | worldserver / authserver |
| Event | crashed / restarted / restart-failed / manual-restart / crash-loop |
| Downtime | How long it was down |

**Implementation:**
- MonitorService stores events to SQLite
- `GET /api/server/events?limit=50`
- Frontend: Timeline/table on dashboard or dedicated view

---

### Tier 3 — Nice But Not Core

> Build only after Tiers 0-2 are rock solid. Do not let these expand or they'll dilute the product identity.

- **Account Management** — list, search, ban/unban (already built)
- **Ban Management** — active bans, unban (already built)
- **Armory / Character Browser** — WoW-native style character detail (gear, stats)
- **Guild Browser** — list + detail (already built)
- **Autobroadcast Management** — CRUD for scheduled messages (already built)

---

## Pages & Navigation

### Sidebar

```
[Logo] Azeroth Dashboard

--- Operations ---
  Dashboard          ← Health, restart, broadcast, recent events
  Console            ← Live logs + SOAP terminal
  Backups            ← Backup management

--- Visibility ---
  Players            ← Online players list (Tier 2)

--- Management ---
  Accounts           ← Account management (Tier 3)
  Bans               ← Ban management (Tier 3)

--- System ---
  Settings           ← Auto-restart, webhooks, config

[User] admin · Logout
```

No separate "admin" section — everything is admin. Clean, flat navigation.

### Page Breakdown

| Page | Path | Tier | Description |
|------|------|------|-------------|
| Dashboard | `/` | 0 | Health, restart buttons, broadcast, player count, recent events |
| Console | `/console` | 0 | Live container logs + SOAP command input |
| Backups | `/backups` | 1 | Backup list, manual trigger, schedule config |
| Players | `/players` | 2 | Online players table |
| Accounts | `/accounts` | 3 | Account list, search, ban actions |
| Bans | `/bans` | 3 | Active bans list, unban |
| Settings | `/settings` | 1 | Auto-restart, webhooks, general config |
| Login | `/login` | 0 | SRP6 login with WoW GM account |

---

## Design System

### Principles
- **Clean, not flashy** — good spacing, clear hierarchy, no visual noise
- **Consistent** — same components everywhere, shadcn/ui as the base
- **Dark theme** — matches the ops/terminal aesthetic
- **Information-dense where needed** — tables and logs should be compact; dashboards should breathe
- **No over-design** — shadcn defaults are already good. Don't fight them.

### Color Palette
| Token | Value | Use |
|-------|-------|-----|
| Background | `#0a0e1a` | Page background |
| Card | `#1a1f2e` | Card/surface background |
| Secondary | `#1f2937` | Inputs, subtle backgrounds |
| Border | `#2a2f3e` | All borders |
| Primary | `#f5a623` | Accents, links, active states |
| Accent | `#4a9eff` | Secondary accent |
| Foreground | `#e5e7eb` | Primary text |
| Muted | `#9ca3af` | Secondary text |
| Destructive | `#ef4444` | Errors, danger actions, crash states |
| Success | `#22c55e` | Online indicators, success states |
| Warning | `#eab308` | Restarting, degraded states |
| Critical | `#dc2626` | Crash loops, system failures (stronger red + pulse) |

### Components (shadcn/ui based)
- **StatusDot** — green/red/yellow dot with optional glow + pulse animation
- **StatCard** — icon + label + value, used on dashboard
- **DataTable** — consistent table styling, header formatting, row hover, empty state with icon
- **ConfirmDialog** — modal with backdrop blur, destructive/primary action variants
- **Terminal** — the existing console component
- **Toast** — success/error feedback for actions (sonner or similar)

### Typography
- Page titles: `text-2xl font-bold`
- Section titles: `text-lg font-semibold`
- Body/tables: `text-sm`
- Mono/technical: `font-mono text-xs`
- Table headers: `text-xs font-medium uppercase tracking-wider text-muted-foreground`

### Spacing
- Page padding: `p-6`
- Section gaps: `space-y-6` or `gap-6`
- Card padding: `p-6`
- Table cell padding: `px-4 py-3`

---

## Technical Architecture

### Backend (NestJS)

**Modules to keep:**
- `auth` — SRP6 login, JWT, guards
- `admin` — SOAP commands, broadcast, account/ban management
- `server` — health endpoint, player queries
- `admin/logs` — Docker log streaming (SSE)
- `admin/backup` — mysqldump, scheduling

**Modules to add:**
- `docker` — Container management service (shared: list, restart, inspect, state)
- `monitor` — Central monitor loop, crash detection, auto-restart, event log, player count recording
- `webhook` — Notification service (Discord-compatible)

**Changes:**
- SOAP service uses env var credentials, not per-user
- Remove credential caching service
- Remove public registration endpoint
- Health endpoint reads cached state from MonitorService (zero I/O per request)
- New SQLite data source for events, player history, settings (local to dashboard, not AC's MySQL)

### Frontend (Next.js)

**Pages to keep:** Login, Console, Backups
**Pages to restructure:** Dashboard (ops-focused), Accounts, Bans
**Pages to remove:** Register, Account (self-service), Characters, Guilds, Armory (move to Tier 3)
**Pages to add:** Players, Settings

**Flatten routes:** Remove `(dashboard)/admin/` prefix. Everything lives under `(dashboard)/`.

### Docker

```yaml
services:
  dashboard-api:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro   # Container monitoring (read-only)
      - dashboard-backups:/backups                      # Backup storage
      - dashboard-data:/data                            # SQLite for events/config/history
    environment:
      - SOAP_HOST, SOAP_PORT, SOAP_USER, SOAP_PASSWORD
      - DB_HOST, DB_PORT, DB_ROOT_PASSWORD
      - JWT_SECRET
      - DISCORD_WEBHOOK_URL
      - AUTO_RESTART_ENABLED=true
```

**Docker Socket Security Note:**
The socket is mounted read-only (`:ro`). The dashboard only uses:
- `GET /containers/json` — list container states
- `GET /containers/{name}/json` — inspect a container
- `GET /containers/{name}/logs` — read/stream logs
- `POST /containers/{name}/restart` — restart (only for allowlisted containers)

No `exec`. No image operations. No network modifications. No volume manipulation.

---

## Implementation Phases

### Phase 1: Restructure + Core (Tier 0)
1. Flatten route structure (remove admin/ prefix, remove player-facing pages)
2. Update sidebar navigation (flat, ops-focused)
3. Remove registration page
4. Switch SOAP to env var credentials
5. Build `DockerService` (shared container operations)
6. Build `MonitorService` (central polling loop, cached state)
7. Build health endpoint (`GET /api/server/health` — cached, fast)
8. Build server health bar component (persistent across all pages)
9. Build restart endpoint + confirmation dialog
10. Move broadcast to dashboard quick-action card
11. Redesign dashboard page (health + restart + broadcast)

### Phase 2: Self-Healing (Tier 1)
1. Add crash detection to MonitorService (state change events)
2. Add event logging (SQLite)
3. Build auto-restart logic with crash loop protection
4. Build webhook notification service
5. Build settings page (auto-restart toggle, webhook URL, cooldowns)
6. Build uptime/restart history view on dashboard
7. Add webhook triggers to backup service

### Phase 3: Visibility (Tier 2)
1. Build online players endpoint + page
2. Add player count recording to MonitorService (every 5 min)
3. Build player count chart
4. Polish dashboard with live data

### Phase 4: Management (Tier 3)
1. Polish account management
2. Polish ban management
3. Build WoW-native armory character detail
4. Polish guild browser

---

## Environment Variables

```env
# Database (AzerothCore MySQL)
DB_HOST=host.docker.internal
DB_PORT=3306
DB_ROOT_PASSWORD=password

# SOAP Service Account
SOAP_HOST=host.docker.internal
SOAP_PORT=7878
SOAP_USER=admin
SOAP_PASSWORD=admin

# Dashboard
JWT_SECRET=change-me-to-something-random
DASHBOARD_PORT=7780
API_PORT=7781

# Monitoring
AUTO_RESTART_ENABLED=true
AUTO_RESTART_COOLDOWN=10
AUTO_RESTART_MAX_RETRIES=3
AUTO_RESTART_RETRY_INTERVAL=30
CRASH_LOOP_THRESHOLD=3
CRASH_LOOP_WINDOW=300

# Notifications
DISCORD_WEBHOOK_URL=
WEBHOOK_EVENTS=crash,restart,crash-loop,backup-failed

# Backups
BACKUP_RETENTION_DAYS=30
```

---

## Success Criteria

**With the dashboard open:**
Admin knows server status in 2 seconds. Can restart, broadcast, or read logs in 10 seconds.

**With the dashboard closed:**
Server crashes → auto-restart fires → Discord alert sent → server recovers → admin sees it later.

**The real test:**
Admin goes to sleep. Server crashes at 3 AM. They wake up to a Discord message: "Worldserver crashed at 03:14, auto-restarted successfully, downtime: 22 seconds." Server has been running fine since.

That's the product.

# Azeroth Dashboard

A self-healing Docker control plane for AzerothCore WoTLK 3.3.5a.

![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)
![License](https://img.shields.io/badge/License-MIT-green)

<!-- screenshot: dashboard overview -->
<!-- Add a screenshot of the main dashboard page here -->

## Why This Exists

AzerothCore has no built-in ops tooling. If your worldserver crashes at 3 AM, nobody knows until players start complaining. Azeroth Dashboard fills that gap — it's a guardian that monitors your server containers, auto-restarts crashed services, detects crash loops, and sends Discord alerts, all without a browser tab open. The dashboard UI is there when you need it, but the protection runs 24/7 regardless.

## Features

### Core Ops
- One-click restart for worldserver, authserver, or both
- Live container log streaming with ANSI color rendering
- SOAP command terminal — execute server commands directly from the browser
- Server-wide announcements and popup notifications

### Self-Healing
- Automatic crash detection and restart (5-second polling)
- Configurable cooldown, retry count, and retry intervals
- Crash loop protection — suspends auto-restart after repeated failures to prevent infinite cycles
- Dependency awareness — won't restart worldserver if authserver is down
- SOAP health monitoring independent of container state

### Visibility
- Real-time server health bar (worldserver, authserver, SOAP connectivity, player count)
- Event timeline logging every crash, restart, recovery, and state change
- Player count history with 5-minute snapshots and 30-day retention
- Discord webhook notifications for crashes, restarts, backup results, and more

### Management
- Online player list with class, race, level, and zone
- Account management — create, search, update expansion, ban/unban
- Guild browser with member details
- Database backups — manual or scheduled via cron, with gzip compression and retention policies
- Dashboard settings UI for all auto-restart, webhook, and backup configuration

## Quick Start

**Prerequisites:** Docker + Docker Compose, a running [AzerothCore WoTLK Docker stack](https://www.azerothcore.org/wiki/install-with-docker)

```bash
git clone https://github.com/your-org/azeroth-dashboard.git
cd azeroth-dashboard
cp .env.example .env          # edit JWT_SECRET at minimum
docker compose up -d
```

Open `http://localhost:7780` and log in with a WoW GM account (gmlevel >= 3).

> **Note:** The `azerothcore-wotlk_ac-network` Docker network must already exist (created by the AzerothCore Docker stack). No modifications to your AzerothCore installation are required.

## Configuration

All configuration is done through environment variables in `.env`. Copy `.env.example` to get started.

### Database & SOAP

| Variable | Description | Default |
|---|---|---|
| `DB_HOST` | AzerothCore MySQL host | `host.docker.internal` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_ROOT_PASSWORD` | MySQL root password | `password` |
| `SOAP_HOST` | Worldserver SOAP host | `ac-worldserver` |
| `SOAP_PORT` | Worldserver SOAP port | `7878` |
| `SOAP_USER` | SOAP admin username | `admin` |
| `SOAP_PASSWORD` | SOAP admin password | `admin` |

### Dashboard

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | Secret for signing auth tokens — **change this** | `change-me-to-something-random` |
| `DASHBOARD_PORT` | Web UI port | `7780` |
| `API_PORT` | Backend API port | `7781` |
| `AC_LOGS_DIR` | Path to AC server log directory on host | `../env/dist/logs` |

### Auto-Restart

| Variable | Description | Default |
|---|---|---|
| `AUTO_RESTART_ENABLED` | Enable automatic crash recovery | `true` |
| `AUTO_RESTART_COOLDOWN` | Delay before first restart attempt (ms) | `10000` |
| `AUTO_RESTART_MAX_RETRIES` | Max restart attempts per incident | `3` |
| `AUTO_RESTART_RETRY_INTERVAL` | Delay between retry attempts (ms) | `15000` |
| `CRASH_LOOP_THRESHOLD` | Crashes within window to trigger loop protection | `3` |
| `CRASH_LOOP_WINDOW` | Time window for crash loop detection (ms) | `300000` |

### Webhooks & Backups

| Variable | Description | Default |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | Discord webhook URL for alerts | _(disabled)_ |
| `WEBHOOK_EVENTS` | Comma-separated event types to notify on | `crash,restart_failed,crash_loop,backup_success,backup_failed` |
| `BACKUP_RETENTION_DAYS` | Days to keep backup files | `30` |

### Production (Reverse Proxy)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Public API URL when behind a proxy | `http://localhost:7781/api` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:7780` |

## Architecture

```
┌──────────────────┐     ┌──────────────────────────────────────────┐
│   Next.js Web    │────▶│              NestJS API                  │
│   :7780          │     │              :7781                       │
└──────────────────┘     │                                          │
                         │  ┌─────────────┐  ┌──────────────────┐  │
                         │  │  Monitor     │  │  Docker Service  │──┼──▶ Docker Socket (ro)
                         │  │  Loop (5s)   │  └──────────────────┘  │
                         │  └──────┬──────┘  ┌──────────────────┐  │
                         │         │         │  SOAP Service    │──┼──▶ Worldserver :7878
                         │         ▼         └──────────────────┘  │
                         │  ┌─────────────┐  ┌──────────────────┐  │
                         │  │  SQLite      │  │  MySQL (AC)      │──┼──▶ auth / characters / world
                         │  │  (events,    │  └──────────────────┘  │
                         │  │   settings,  │                        │
                         │  │   history)   │                        │
                         │  └─────────────┘                        │
                         └──────────────────────────────────────────┘
```

**NestJS API** is the brain. A central monitor loop polls Docker container states and SOAP connectivity every 5 seconds, caches the result, and triggers self-healing actions when things go wrong. The Docker socket is mounted **read-only** — the API only uses the Engine API to inspect and restart the AC containers.

**Next.js Web** is the eyes. It reads cached health state from the API (instant response, no polling delay on the frontend) and streams container logs via SSE.

**SQLite** stores dashboard-specific data: events, player count history, auto-restart settings, and backup schedules. AzerothCore's MySQL databases are accessed read-only for player/account/guild data, with writes only going through SOAP commands.

## Pages

<!-- screenshot: dashboard home -->
<!-- screenshot: console page -->
<!-- screenshot: players page -->
<!-- screenshot: backups page -->
<!-- screenshot: accounts page -->
<!-- screenshot: events page -->
<!-- screenshot: settings page -->

| Page | What it does |
|---|---|
| **Dashboard** | Health bar, restart buttons, broadcast, recent events |
| **Console** | Live log streaming (worldserver/authserver tabs), SOAP command terminal |
| **Players** | Online player list with search — name, level, class, race, zone |
| **Backups** | Manual/scheduled database backups, download, delete, retention config |
| **Accounts** | Account list, create, search, ban/unban, expansion management |
| **Bans** | Active bans with reason, duration, and unban action |
| **Events** | Full event history — crashes, restarts, recoveries, with timestamps and downtime |
| **Settings** | Auto-restart tuning, webhook configuration, test webhook |

## Tech Stack

- **Frontend:** Next.js, React, shadcn/ui, Tailwind CSS, Recharts
- **Backend:** NestJS, TypeORM, SQLite
- **Infrastructure:** Docker, Docker Compose, Turborepo
- **Communication:** Docker Engine API, SOAP, Server-Sent Events
- **Auth:** SRP6 (WoW-native) + JWT

## Contributing

```bash
# Prerequisites: Node.js >= 18, pnpm 9+
git clone https://github.com/your-org/azeroth-dashboard.git
cd azeroth-dashboard
pnpm install
pnpm dev
```

The API runs on `:3001` and the web app on `:3000` in dev mode. You'll need a running AzerothCore MySQL instance and Docker socket access.

- Open an issue before starting large changes
- PRs welcome — keep them focused and tested

## License

MIT

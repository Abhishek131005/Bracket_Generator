# Zemo Bracket Generator

A tournament management platform for running many different sports from one place. Pick a sport, add participants, generate the right competition structure (knockout brackets, league tables, Swiss, heats, leaderboards), enter results, and watch brackets and standings update live for everyone viewing.

## Features

- **51 sports** mapped to a competition format and ranking rule (`apps/api/src/data/sports.ts`).
- **Formats:** single elimination, double elimination (with grand-final reset), round robin, Swiss, league + playoff, heats + final, direct final, multi-event points, judged leaderboard.
- **Correct bracket logic:** standard seeding (seeds 1 and 2 only meet in the final), byes for odd player counts, winners and losers routing, and safe correction of played results (changing a winner asks before resetting later matches).
- **Leaderboards:** time and distance (best attempt per athlete, shared places for ties), High Jump with the official countback tie-break, judged scoring with judge-by-judge scores.
- **Live updates:** Socket.IO rooms per stage push changes to every viewer.
- **Accounts and roles:** JWT login with Admin, Organizer, Referee and Viewer roles, enforced on the API and reflected in the UI.
- **Status tracking:** stages and tournaments move from Draft to In Progress to Completed on their own as results come in.
- **Bracket Lab:** preview a bracket from a list of names without saving anything.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, TanStack Query, Zustand, Framer Motion, plain CSS |
| Backend | Node.js, Express, TypeScript, zod |
| Database | PostgreSQL with Prisma |
| Auth | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` |
| Real time | Socket.IO |
| Tests | Node's built-in test runner with `tsx` |

## Project layout

```
apps/
  api/                    Express API, Prisma schema, competition engines
    prisma/schema.prisma  Database schema
    src/engine/           Pure competition logic (brackets, schedules, standings, status, progression)
    src/repositories/     Database access and stage generation
    src/index.ts          Routes, validation, Socket.IO server
    src/seed.ts           Demo data and demo accounts
    scripts/              set-role.ts (create admins), smoke tests
  web/                    React single-page app
    src/pages/            Home, Create, Tournament Hub, Sports, Bracket Lab, Auth, Admin
    src/components/       Brackets (SVG), fixtures, standings, leaderboards
    src/hooks/            Queries, mutations, live-update and permission hooks
docs/zemo-platform-plan.md  Original product and architecture plan
```

## Getting started

### Prerequisites

- Node.js 20 or newer
- PostgreSQL, running locally (16 is what `docker-compose.yml` uses)

### 1. Install

```bash
npm install
```

### 2. Create the database and configure the API

Create an empty database (the name is up to you; `zemo` is used below):

```bash
createdb zemo          # or: psql -U postgres -c "CREATE DATABASE zemo;"
```

Copy the example environment file and edit it:

```bash
cp apps/api/.env.example apps/api/.env
```

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string, e.g. `postgresql://postgres:password@localhost:5432/zemo` |
| `JWT_SECRET` | Secret used to sign login tokens. Use a long random value; generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PORT` | API port (optional, default `4000`) |

Create the tables:

```bash
npm run db:push -w apps/api
```

### 3. Add demo data (recommended)

```bash
npm run seed -w apps/api
```

This creates six `[Demo]` tournaments (partly played brackets, a league, a high jump final, a judged event) and four accounts. Running it again replaces the `[Demo]` tournaments and resets these accounts' passwords.

| Account | Password | Role |
|---|---|---|
| `admin@zemo.io` | `demo1234` | Admin: everything, plus the **Users** page |
| `organizer@zemo.io` | `demo1234` | Organizer: create tournaments, add participants, generate stages |
| `referee@zemo.io` | `demo1234` | Referee: enter scores and results |
| `viewer@zemo.io` | `demo1234` | Viewer: read-only |

These are demo credentials only. Do not use them on a real deployment.

### 4. Run

```bash
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:4000/api (health check at http://localhost:4000/health)

The Vite dev server proxies `/api` and `/socket.io` to the API, so no extra configuration is needed.

## Roles and permissions

Anyone can register, but **new accounts always start as Viewers**. An admin upgrades people from the **Users** page.

| Action | Viewer | Referee | Organizer | Admin |
|---|:-:|:-:|:-:|:-:|
| Browse tournaments, brackets, standings, leaderboards | yes | yes | yes | yes |
| Enter or correct scores and performance results | | yes | yes | yes |
| Create tournaments, add participants, generate stages, delete | | | yes | yes |
| Change user roles | | | | yes |

### Creating the first admin

Use the seeded `admin@zemo.io` account, or promote your own account after registering:

```bash
npm run set-role -w apps/api -- you@example.com ADMIN
```

Role changes are picked up the next time the user opens or refreshes the app.

## Typical workflow

1. Sign in as an organizer and open **New Tournament**. Choose a sport and a name.
2. In the **Tournament Hub**, add participants (one per line). Seeds are assigned in the order entered.
3. Open the **Stages** tab and generate a stage. Any format can be generated for any tournament.
4. Referees enter scores in the Fixtures list or by clicking a match in the bracket. Brackets, standings and leaderboards update for everyone watching.
5. Match-based stages complete automatically when every match is finished. Leaderboard stages are closed with **Finish stage**.

## Testing

```bash
npm test -w apps/api    # engines, progression rules, status rules, auth, Socket.IO rooms
npm test -w apps/web    # bracket reconstruction, ranking and formatting helpers
```

`npm run build` compiles both apps (which also type-checks them).

## Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | Start API and web app together |
| `npm run dev:api` / `npm run dev:web` | Start one of them |
| `npm run db:push -w apps/api` | Apply the Prisma schema to the database |
| `npm run db:studio -w apps/api` | Open Prisma Studio on port 5555 |
| `npm run seed -w apps/api` | Reset and load demo data |
| `npm run set-role -w apps/api -- <email> <ROLE>` | Change an account's role |
| `npm run build` | Build both apps |

## API overview

Base path `/api`. Reads are public; writes need an `Authorization: Bearer <token>` header from `POST /api/auth/login`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/refresh` |
| Admin | `GET /admin/users`, `PATCH /admin/users/:id/role` |
| Catalog | `GET /sports`, `GET /formats` |
| Tournaments | `GET/POST /tournaments`, `GET/DELETE /tournaments/:id` |
| Participants | `GET/POST /tournaments/:id/participants`, `DELETE /participants/:id` |
| Stages | `GET /tournaments/:id/stages`, `POST /tournaments/:id/stages/<format>`, `DELETE /stages/:id`, `PATCH /stages/:id/status` |
| Matches | `GET /stages/:id/fixtures`, `PATCH /fixtures/:id/result`, `GET /stages/:id/standings` |
| Results | `GET/POST /stages/:id/performances`, `DELETE /performances/:id` |
| Bracket Lab | `POST /brackets/single-elimination`, `/double-elimination`, `/round-robin`, `/swiss` |

Real-time events (Socket.IO): clients emit `join:stage` / `leave:stage`; the server emits `fixture:updated`, `performance:updated` and `stage:updated` to the stage room after a change.


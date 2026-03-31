# Zemo Sports Tournament Platform Plan

## 1. Product Goal

Build one platform that can run all Zemo sports with the right competition logic per sport:
- Bracket based sports: knockout progression
- League based sports: fixtures plus points table
- Leaderboard sports: rank by time, distance, height, or judges score

Core principle:
- Separate tournament structure (format) from scoring logic (ranking rule)
- This gives flexibility without rewriting the system for every sport

## 2. Competition Engine Blueprint

### 2.1 Format Types

Use these reusable format templates in backend:
- SINGLE_ELIMINATION
- DOUBLE_ELIMINATION
- ROUND_ROBIN
- SWISS
- LEAGUE_PLUS_PLAYOFF
- HEATS_PLUS_FINAL
- DIRECT_FINAL
- MULTI_EVENT_POINTS
- JUDGED_LEADERBOARD
- CUSTOM

### 2.2 Ranking Rules

Use scoring strategies independent from format:
- HEAD_TO_HEAD_SCORE (games/sets/goals)
- POINTS_TABLE (win/draw/loss points, tie-breakers)
- TIME_ASC (lowest time ranks first)
- DISTANCE_DESC (highest distance ranks first)
- HEIGHT_DESC_WITH_COUNTBACK
- JUDGES_SCORE_DESC
- AGGREGATE_POINTS_DESC

## 3. Sport to Format Mapping (Your List)

| ID | Sport Name | Recommended Competition Model | Bracket Needed | Ranking Logic | UI Primary View |
|---|---|---|---|---|---|
| 1 | Badminton | SINGLE_ELIMINATION (or pool plus knockout) | Yes | HEAD_TO_HEAD_SCORE | Bracket + match cards |
| 2 | Chess | SWISS (or ROUND_ROBIN) | Not mandatory | POINTS_TABLE + tie-breakers | Pairings + standings table |
| 3 | Cricket | LEAGUE_PLUS_PLAYOFF | Partial | POINTS_TABLE + NRR + playoffs | Fixtures + points table + playoff bracket |
| 4 | Snooker | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE (frames) | Bracket |
| 5 | Basketball | LEAGUE_PLUS_PLAYOFF | Partial | POINTS_TABLE then knockout | Fixtures + standings + bracket |
| 6 | Walkathon | DIRECT_FINAL | No | TIME_ASC or DISTANCE_DESC | Leaderboard |
| 8 | Table Tennis | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 9 | Volleyball | LEAGUE_PLUS_PLAYOFF | Partial | POINTS_TABLE then knockout | Fixtures + standings + bracket |
| 10 | Tug of War | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 11 | Jenga | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 12 | Swimming | HEATS_PLUS_FINAL | No | TIME_ASC | Heat sheets + leaderboard |
| 13 | Carrom | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 14 | Marathon | DIRECT_FINAL | No | TIME_ASC | Leaderboard with splits |
| 15 | Kabaddi | LEAGUE_PLUS_PLAYOFF | Partial | POINTS_TABLE then knockout | Fixtures + standings + bracket |
| 16 | 8 Ball Pool | DOUBLE_ELIMINATION (or single elimination) | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 17 | Tele Games | CUSTOM (SWISS/LEAGUE/KO based on game) | Depends | Depends on mode | Mode specific board |
| 18 | Athletics | MULTI_EVENT_POINTS | No | AGGREGATE_POINTS_DESC | Event cards + overall team leaderboard |
| 19 | Lawn Tennis | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 20 | Squash | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 21 | Throwball | LEAGUE_PLUS_PLAYOFF | Partial | POINTS_TABLE then knockout | Fixtures + standings + bracket |
| 22 | Football | LEAGUE_PLUS_PLAYOFF | Partial | POINTS_TABLE then knockout | Fixtures + standings + bracket |
| 23 | Foonsball | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 24 | Bridge | ROUND_BASED_LEADERBOARD (custom) | No | AGGREGATE_POINTS_DESC | Round results + leaderboard |
| 25 | Pickleball | ROUND_ROBIN plus SINGLE_ELIMINATION | Yes in finals | POINTS_TABLE then knockout | Pools + bracket |
| 26 | Padel Tennis | ROUND_ROBIN plus SINGLE_ELIMINATION | Yes in finals | POINTS_TABLE then knockout | Pools + bracket |
| 27 | Billiards | SINGLE_ELIMINATION | Yes | HEAD_TO_HEAD_SCORE | Bracket |
| 28 | Skating | DIRECT_FINAL (or heats plus final) | No | TIME_ASC | Leaderboard |
| 29 | Crossfit | MULTI_EVENT_POINTS | No | AGGREGATE_POINTS_DESC | Workout cards + total standings |
| 30 | Shot Put | DIRECT_FINAL | No | DISTANCE_DESC | Attempt table + leaderboard |
| 31 | Discus Throw | DIRECT_FINAL | No | DISTANCE_DESC | Attempt table + leaderboard |
| 32 | Javelin Throw | DIRECT_FINAL | No | DISTANCE_DESC | Attempt table + leaderboard |
| 33 | Long Jump | DIRECT_FINAL | No | DISTANCE_DESC | Attempt table + leaderboard |
| 34 | Triple Jump | DIRECT_FINAL | No | DISTANCE_DESC | Attempt table + leaderboard |
| 35 | High Jump | DIRECT_FINAL | No | HEIGHT_DESC_WITH_COUNTBACK | Attempt matrix + leaderboard |
| 36 | Running (100M) | HEATS_PLUS_FINAL | No | TIME_ASC | Heat sheets + leaderboard |
| 37 | Running (200M) | HEATS_PLUS_FINAL | No | TIME_ASC | Heat sheets + leaderboard |
| 38 | Running (400M) | HEATS_PLUS_FINAL | No | TIME_ASC | Heat sheets + leaderboard |
| 39 | Running (800M) | HEATS_PLUS_FINAL (or direct final) | No | TIME_ASC | Heat sheets + leaderboard |
| 40 | Running (1500M) | DIRECT_FINAL (or heats plus final) | No | TIME_ASC | Leaderboard |
| 41 | Running (1600M) | DIRECT_FINAL | No | TIME_ASC | Leaderboard |
| 42 | Running (3000M) | DIRECT_FINAL | No | TIME_ASC | Leaderboard |
| 43 | Running (5000M) | DIRECT_FINAL | No | TIME_ASC | Leaderboard |
| 44 | Running (10000M) | DIRECT_FINAL | No | TIME_ASC | Leaderboard |
| 45 | Indian Artyrst | JUDGED_LEADERBOARD (assumption) | No | JUDGES_SCORE_DESC | Judges panel + leaderboard |
| 46 | Freestyle | HEATS_PLUS_FINAL | No | TIME_ASC | Heat sheets + leaderboard |
| 47 | Backstroke | HEATS_PLUS_FINAL | No | TIME_ASC | Heat sheets + leaderboard |
| 48 | Breaststroke | HEATS_PLUS_FINAL | No | TIME_ASC | Heat sheets + leaderboard |
| 49 | Butterfly | HEATS_PLUS_FINAL | No | TIME_ASC | Heat sheets + leaderboard |
| 50 | Relay | HEATS_PLUS_FINAL | No | TIME_ASC | Team heat sheets + leaderboard |
| 51 | Karate | SINGLE_ELIMINATION with repechage | Yes | HEAD_TO_HEAD_SCORE | Bracket + repechage lane |
| 52 | Box Cricket | LEAGUE_PLUS_PLAYOFF | Partial | POINTS_TABLE then knockout | Fixtures + standings + bracket |

Notes:
- ID 7 is missing in the provided list.
- "Foonsball" may be a typo for Foosball.
- "Indian Artyrst" is ambiguous and may need confirmation.

## 4. Stunning UI Direction (Non Generic)

### 4.1 Visual Language

Pick one strong style and stay consistent.

Recommended style:
- Theme name: Arena Pulse
- Background: layered gradients plus subtle noise plus diagonal line pattern
- Typography:
  - Display font: Bebas Neue or Anton for big sporty headlines
  - Body font: Plus Jakarta Sans or Manrope for readability
- Color system (no purple bias):
  - --bg-base: #0D1B2A
  - --bg-elev: #1B263B
  - --text-main: #F4F1DE
  - --accent-lime: #C7F464
  - --accent-coral: #FF6B35
  - --accent-cyan: #2EC4B6
  - --accent-gold: #F4D35E

### 4.2 Signature UI Components

- Hero scoreboard strip with live counters and animated ticker
- Sport cards with unique icon, gradient glow, and mini format chip (Bracket/League/Board)
- Bracket canvas with pan/zoom, animated connectors, winner path highlight
- Leaderboard cards with animated reorder when ranks change
- Match center with large score numerals, timeline events, and possession/serve indicators

### 4.3 Motion Plan

Use meaningful motion, not random animation:
- Page load: staged reveal (header, controls, content)
- Bracket generation: draw lines first, then pop match nodes
- Score update: pulse the changed team row, then settle
- Leaderboard reorder: spring based transition with position memory

### 4.4 Mobile First UX

- Horizontal bracket swipe with mini-map navigator
- Sticky quick actions for score entry
- Compact leaderboard mode with swipeable metrics
- Bottom sheet for participant details and recent results

## 5. Backend Architecture (Node.js)

Recommended stack:
- Node.js + TypeScript + Fastify (or Express if team preference)
- PostgreSQL + Prisma for relational tournament data
- Redis for caching and pub/sub events
- Socket.IO for live scoreboard/bracket updates

Core modules:
- Auth and roles (Admin, Organizer, Referee, Viewer)
- Sports config service (format defaults per sport)
- Tournament service (create stages, seed participants)
- Match service (results, validations, walkovers)
- Leaderboard service (time/distance/judges ranking)
- Notification service (real-time and activity feed)

## 6. Frontend Architecture (React)

Recommended stack:
- React + Vite + TypeScript
- Tailwind CSS with design tokens (CSS variables)
- Framer Motion for premium transitions
- TanStack Query for server state
- Zustand for lightweight UI state
- React Flow or custom SVG layer for brackets

Key pages:
- Landing and Showcase
- Create Tournament Wizard
- Tournament Overview
- Bracket View
- Fixtures and Standings View
- Leaderboard View
- Live Match Control Panel

## 7. Data Model Essentials

Main entities:
- SportDefinition
- Tournament
- Stage
- Participant (team or individual)
- Fixture (head-to-head)
- PerformanceEntry (time/distance/height/judge)
- StandingSnapshot
- AuditLog

Important design choice:
- Tournament has many stages; each stage has its own format and ranking rule
- Example: Cricket group stage (LEAGUE) then playoffs (SINGLE_ELIMINATION)

## 8. API Design (Starter)

- POST /sports
- GET /sports
- POST /tournaments
- GET /tournaments/:id
- POST /tournaments/:id/stages
- POST /stages/:id/generate
- POST /fixtures/:id/result
- POST /performances
- GET /stages/:id/standings
- GET /tournaments/:id/live

Socket channels:
- tournament:{id}:updated
- stage:{id}:updated
- fixture:{id}:updated
- leaderboard:{stageId}:updated

## 9. Delivery Roadmap

Week 1:
- Finalize sport mapping and edge rules
- Build design system tokens and core layout shell

Week 2:
- Implement auth, sport definitions, tournament CRUD
- Build create tournament wizard UI

Week 3:
- Implement bracket engine (single and double elimination)
- Build bracket viewer with interaction

Week 4:
- Implement league and swiss standings engine
- Build fixtures plus standings screen

Week 5:
- Implement timed and field event leaderboards
- Build attempt/time entry and ranking screen

Week 6:
- Real-time sync with Socket.IO and live control panel
- Motion and visual polish

Week 7:
- QA, edge cases, and accessibility checks
- Load test and optimize API queries

Week 8:
- Demo data, screenshots, final review, deployment

## 10. Non Functional Checklist

- Accessibility: keyboard navigation, focus states, contrast
- Performance: virtualized tables, memoized bracket nodes, Redis caching
- Reliability: optimistic updates with rollback, audit history
- Security: role based permissions, rate limits, input validation

## 11. Immediate Next Decisions

- Confirm final meaning of Tele Games and Indian Artyrst
- Confirm whether Chess should default to Swiss format
- Confirm whether Cricket is league-first or knockout-first
- Confirm if you want PostgreSQL (recommended) or MongoDB

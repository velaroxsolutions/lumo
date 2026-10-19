# lumo

**Light up the day.** A daily planning ritual for ambitious people, with a game layer that takes real goals seriously.

Every evening, about two minutes: **close today → one-line review → plan tomorrow**. Doing that lights today's dot on The Week. Every morning you open to a plan that already exists, with your one Focus Goal on top.

A Velarox Solutions product. Free and offline-first, with an optional account that backs up your data and syncs it across devices.

---

## Run it

```bash
# the app
cd app
npm install
npx expo start          # press i / a for a simulator, or scan with Expo Go
npx expo start --web    # browser version (desktop planning sessions)
npm test                # logic + sync tests
npx expo lint

# the sync server (optional: the app works fully without it)
cd server
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn main:app --port 8000
.venv/bin/python -m pytest -q
```

`app/` is an Expo SDK 58 project (React Native 0.88, Expo Router, plain JavaScript). `server/` is FastAPI with stdlib `sqlite3`, following the Cadence conventions.

### Deploy (one container: API + web app on one origin)

```bash
docker build -t lumo .
docker run -p 8000:8000 -v lumo-data:/data -e SMTP_HOST=… -e SMTP_USER=… -e SMTP_PASS=… -e SMTP_FROM=… lumo
```

Put HTTPS in front of it. The server serves the web build with the cross-origin-isolation headers that web SQLite needs, falls back to the app for deep links like `/goals`, and keeps the database in the `/data` volume. Brand assets are regenerated with `node app/scripts/render-brand-assets.js`, and the marketing page is `landing/index.html`.

The app talks to `http://localhost:8000` by default. To test on a phone, point it at your machine with `EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:8000 npx expo start`. Server settings are in `server/.env.example`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch and commit conventions.

## What's built (Phase 1: v1, fully offline)

Feature IDs refer to the feature spec (v0.1).

| Area | Built |
|---|---|
| **Life structure** | Areas (F1.1, archivable, never deleted) · Goals (F1.2) · exactly one **Focus Goal** (F1.3) · Rituals: recurring named blocks with a weekday mask (F1.4) |
| **Tasks & backlog** | Task CRUD (F2.1) · **quick capture** FAB, title only, area defaults to the last one used (F2.2) · backlog grouped by area (F2.3) · time estimate (F2.4) · **"how long did that really take?"**, one tap and skippable (F2.5) · energy tag (F2.6) |
| **Day planning** | DayPlan (F3.1) · **evening ritual** (F3.2) · morning view (F3.3) · backlog → tomorrow (F3.4) · **overcommit warning**, soft and never a block (F3.5) · **close the day** with "push to tomorrow / backlog / let go" (F3.6) · time blocking with auto-layout (F3.7) · rituals pre-placed on matching weekdays (F3.8) · a "pushed 3×" nudge (F3.9, pulled forward) |
| **Calendar** | Day timeline (F4.1) · week view (F4.2) |
| **Review** | Daily note (F5.1) · rotating prompts (F5.2) · energy 1–5 (F5.3) · journal of past reviews |
| **Game layer** | **Day-close animation**: dots light left to right about 90 ms apart with spring overshoot, then the streak pops (F6.1) · **planning streak** (F6.2) · **2 auto-applied freezes per month** (F6.3) · Focus Goal bar (F6.4) · per-area completion rings (F6.5) · 25/50/75/100% milestones (F6.6) |
| **Insights** | Planned vs. closed over 7 or 28 days (F7.1) · where the week went, per area (F7.2) · **estimate accuracy**, unlocked after 5 logged tasks (F7.4, pulled forward from v2) |
| **Systems** | Backlog → Tomorrow · Time Blocker · Top 3 (hard cap) (F8.1–8.3), switchable in one tap |
| **Platform** | Local SQLite with additive migrations (F12.1) · local evening and morning reminders (F12.3) · dark-first (F12.4) · onboarding: areas → focus goal → system → reminder (F12.5) · web build (F12.6) |

### Product decisions baked in

- **What lights a dot:** finishing the evening ritual. Closing today and planning tomorrow count as one act. The streak counts days you *showed up*, not perfect days.
- **Freezes:** a missed day during a running streak spends a freeze automatically, two per calendar month. A frozen day keeps the streak alive but doesn't add to it.
- **Focus Goal:** a hard limit of one, enforced in the data layer.
- **Unfinished tasks:** the close step asks "push to tomorrow, or let them go?", and the default comes from the system you picked.
- **Days you never closed:** their unfinished tasks quietly go back to the backlog, with a one-line note. Today's plan never gets flooded with a week of leftovers.
- **The day rolls over at 4am**, so closing the day at 12:40am still closes "today".
- **No comparison to other users anywhere.** Insights are you against you.

## Batches after Phase 2 (built)

| Batch / branch | What it adds |
|---|---|
| **A** `feature/goals-and-tasks-v2` | Deadlines, with plain due badges and an overdue note on Today (F2.9) · recurring tasks: daily, weekdays, weekly, monthly. They spawn the next occurrence on completion, with date-derived ids so two devices never double-spawn (F2.8) · one level of subtasks (F2.7) · goals measured by a number or by linked tasks (F1.5) · checkpoints inside a goal, which can tick themselves at a value (F1.6) · pace and a projected finish date (F7.7) |
| **B** `feature/weekly-loop` | Week ritual: look back at the week, write one line, then lay out next week task by task (F3.10, F5.4) · suggested tomorrow, with the reason for each pick (F10.1) · estimate correction from your own history (F10.2) · month heatmap (F4.3) · journal search (F5.5) · personal bests (F6.9) · energy vs. follow-through (F7.5) · when you finish things (F7.6) |
| **C** `feature/share-card-and-brand-assets` | Shareable streak card: only the streak and this week's dots (F11.2) · real icon, adaptive icon, splash and favicon from the brand marks · landing page (F12.10) |
| **D** `feature/server-deploy-and-account-hardening` | Dockerfile with the web app served on the same origin · password reset with an emailed 6-digit code (single-use, 15 minutes, 5 tries; signs out every other device) · signing in on a device that already has plans asks **use my account's plans** or **keep both**. Replace downloads the account's data *before* clearing anything, and offers to save a copy of the device first |

The schema is now at v4, migrating additively from v1. New tables: `subtasks`, `milestones`, `goal_logs`, `week_reviews`, all synced.

## Phase 2: account & sync (built)

| Feature | What it does |
|---|---|
| **Account** (F12.2) | Email and password. PBKDF2-SHA256 with 310k iterations (stdlib). Random session tokens, stored only as hashes. Login throttling. The account is optional, and signing out keeps everything on the device. |
| **Sync** (F12.7) | Every local write lands in a `sync_outbox`. The app pushes, then pulls whatever changed since its cursor. **Last write wins per field**, so two devices editing different fields of one task both keep their edit. |
| **Clock guard** | Timestamps from a device whose clock runs ahead are clamped to server time, so a broken clock can't win every future conflict. |
| **Deletes** | Deletes sync as tombstones. A delete that's older than a newer edit loses, and the row comes back. A deleted row can only be revived by a newer full re-insert (for example, un-planning a task and planning it again). |
| **Same-day plans** | Day plans use date-based ids (`dp-2026-10-20`), so two devices planning the same evening merge into one plan instead of colliding. Phase 1 databases are migrated automatically. |
| **Never blocks the UI** | Network calls run outside the write queue. Sync runs 1.5 s after you stop tapping, every 60 s, and when the app comes to the foreground. When offline, it says so and retries. |
| **Your data** (F12.9) | Export everything as JSON: a download on web, the share sheet on phones. You can delete the account and all server data, with your password to confirm. |
| **The honest metric** | `GET /admin/metrics` (needs `LUMO_ADMIN_TOKEN`) returns **% of users who closed a day in week 4**, computed from data that sync already holds. There's no extra tracking. |

**Verified:** 18 server tests (auth, per-field merge, clock guard, tombstones and revival, pagination, user isolation, input validation, export and delete, metric). 30 app tests: the new sync tests run the real schema, migrations, outbox and apply code against real SQLite (`node:sqlite`). A two-device browser test with separate storage: A signs up with existing data → B signs in fresh and skips onboarding → a new task and a delete go B → A → a plan made on A shows on B's Today → export → sign out keeps local data. All Phase 1 browser flows still pass.

## Architecture

```
app/src/
├─ app/                    Expo Router screens (routes)
│  ├─ (tabs)/              Today · Backlog · Goals · Calendar · Insights
│  ├─ ritual.js            the evening ritual + day-close payoff
│  ├─ onboarding.js        under 90 seconds
│  └─ settings.js, areas.js, journal.js
├─ core/
│  ├─ useDayPlan.js        ← THE seam: all plan state and actions for a date
│  ├─ useTasks.js  useAreas.js  useGoals.js  useSettings.js
│  ├─ store.js             in-memory mirror of the DB + every write action (serialized queue)
│  ├─ db.js                expo-sqlite schema, versioned additive migrations, outbox tracking
│  ├─ sync.js  api.js      account + push/pull engine (Phase 2)
│  ├─ systems.js           the presets, as data rather than branching
│  ├─ logic/               pure, unit-tested: streak.js, plan.js, insights.js
│  ├─ copy.js              every user-facing line, in brand voice
│  ├─ dates.js  theme.js  notifications.js
└─ components/             WeekMark (the mark + animated week), ui primitives, sheets

server/
├─ main.py                 FastAPI routes + lifespan
├─ authn.py                accounts, PBKDF2, sessions, throttling
├─ sync.py                 per-field last-write-wins merge, pull cursors, export
├─ metrics.py              week-4 planning retention
├─ db.py  config.py        stdlib sqlite3, additive init_db migrations
└─ tests/
```

These seams hold everywhere: screens never touch the database directly. A preset is a config object, so adding a fifth system never touches planning logic. Every write goes to local SQLite first, and the UI never waits on a network. Rows use random text IDs plus `updated_at`, so Phase 2 sync can do last-write-wins without a schema change.

## Verified

- **App:** 52 unit tests. They cover streaks and freezes, planning rules, recurrence, deadlines, goal pace, estimate correction, suggestions, the weekly summary and insights. The sync tests run the real schema, migrations v1 → v4, outbox and apply code against real SQLite (`node:sqlite`). `expo lint` is clean.
- **Server:** 27 tests. They cover auth, per-field merge, the clock guard, tombstones and revival, pagination, user isolation, input validation, export and delete, the retention metric, password reset (including the 5-try limit and single use), and same-origin web serving with the SPA fallback.
- **Browser suites:** headless Chromium on the web build, at a 390×844 phone viewport, with a fake clock where days need to pass:
  - Phase 1 core loop.
  - A 4-day run.
  - Two-device sync.
  - Batch A: recurring, subtasks, overdue, linked-task goals, checkpoints.
  - Batch B: estimate hint, suggestions, week ritual, journal search, heatmap, insights.
  - Batch C: share card download, a real 1080×1350 PNG.
  - Batch D: replace, merge, emailed reset code, sessions revoked everywhere else.
- **Container:** the Docker image built and ran here. It reports healthy, runs as non-root, and stores data in the `/data` volume. Its pages are cross-origin isolated, and sign-up works against the same origin. A hard refresh on `/goals` loads the app with data intact.

## Not done yet / known gaps

- **Not yet run on a physical iPhone or Android device.** Everything was verified on the web build. Reminders, the native share sheet for the streak card and data export, and the new icons need an on-device check.
- **Not hosted yet.** The image builds and runs, but it still needs a host, HTTPS in front, and SMTP credentials for reset emails.
- **"Keep both" can duplicate starter areas.** Choosing it on two devices that were set up separately can leave areas like "Academics" twice; archive the extras.
- **Moving tasks into tomorrow is tap-to-add** plus up/down reorder. Spec F3.4 says long-press drag; that's a polish item.
- **The share-sheet capture target** (part of F2.2) needs native config and isn't built yet.

## Next

Host the container · run it on real phones (reminders, share sheet, icons) · widgets (F12.8) · Todoist import behind an adapter with a mock (F9.1) · day templates (F3.11) · tags and bulk actions (F2.10, F2.11) · achievement badges (F6.7).

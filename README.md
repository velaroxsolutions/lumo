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

- 19 unit tests on the logic: streak and freeze edge cases, month refill, overcommit, rituals by weekday, time-block layout, the Top 3 cap, the 4am rollover, and estimate accuracy.
- End-to-end in headless Chromium on the web build, at a 390×844 phone viewport:
  - onboarding → capture → close the day → review → plan tomorrow → day-close animation → reload, with the data still there.
  - a simulated 4-day run with a fake clock: the Top 3 cap blocks a 4th task, logging actual time works, carry-forward works, a skipped day spends a freeze and keeps the streak, and leftovers from an unclosed day return to the backlog.
- `expo lint` is clean, and the production web export builds.

## Not done yet / known gaps

- **Not yet run on a physical iPhone or Android device.** Everything above was verified on the web build. Native should behave the same, but the reminders (F12.3) in particular need an on-device check.
- **No hosted server yet.** Sync works against a server you run. Deploying it (Docker plus a volume for `DATA_DIR`, HTTPS) is the next ops step, and phones need it at a public HTTPS URL.
- **Signing in on a device that already has its own separate data merges the two.** Starter areas created on both devices show up twice and need archiving by hand. Signing in from the welcome screen avoids this.
- **There's no password reset yet.** It needs an email sender.
- **Moving tasks into tomorrow is tap-to-add** plus up/down reorder. Spec F3.4 says long-press drag; that's a polish item.
- **The share-sheet capture target** (part of F2.2) needs native config and isn't built yet.
- **The app icon and splash are still Expo placeholders.** They should be swapped for the brand assets (Sunbeam ground, Ink dots).
- **Web hosting** must send `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` for SQLite on the web. This is already configured in `app.json` for EAS Hosting.

## Next

Deploy the server · password reset · widgets (F12.8) · week planning ritual (F3.10) · shareable streak card (F11.2) · goal velocity (F7.7) · Todoist import behind an adapter with a mock (F9.1).

# lumo

**Light up the day.** A daily planning ritual for ambitious people, with a game layer that takes real goals seriously.

Every evening, about two minutes: **close today → one-line review → plan tomorrow**. Doing that lights today's dot on The Week. Every morning you open to a plan that already exists, with your one Focus Goal on top.

A Velarox Solutions product. Free and offline-first.

---

## Run it

```bash
cd app
npm install
npx expo start          # press i / a for a simulator, or scan with Expo Go
npx expo start --web    # browser version (desktop planning sessions)
npm test                # logic tests (streaks, freezes, planning rules, copy)
npx expo lint
```

`app/` is an Expo SDK 58 project (React Native 0.88, Expo Router, plain JavaScript).

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
│  ├─ db.js                expo-sqlite schema, versioned additive migrations
│  ├─ systems.js           the presets, as data rather than branching
│  ├─ logic/               pure, unit-tested: streak.js, plan.js, insights.js
│  ├─ copy.js              every user-facing line, in brand voice
│  ├─ dates.js  theme.js  notifications.js
└─ components/             WeekMark (the mark + animated week), ui primitives, sheets
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
- **No account or sync yet** (F12.2, Phase 2). Data lives on one device or one browser.
- **Moving tasks into tomorrow is tap-to-add** plus up/down reorder. Spec F3.4 says long-press drag; that's a polish item.
- **The share-sheet capture target** (part of F2.2) needs native config and isn't built yet.
- **The app icon and splash are still Expo placeholders.** They should be swapped for the brand assets (Sunbeam ground, Ink dots).
- **Web hosting** must send `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` for SQLite on the web. This is already configured in `app.json` for EAS Hosting.

## Next (Phase 2)

FastAPI account and sync (`server/`, using the Cadence conventions) · an anonymous retention ping for the week-4 planning metric · widgets (F12.8) · week planning ritual (F3.10) · shareable streak card (F11.2) · goal velocity (F7.7) · Todoist import behind an adapter with a mock (F9.1).

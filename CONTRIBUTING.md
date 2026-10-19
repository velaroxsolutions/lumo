# Contributing to lumo

## Branches

`main` is always releasable. All work happens on a short-lived branch cut from `main` and merged back through a pull request.

| Prefix | Use it for | Example |
|---|---|---|
| `feature/` | new functionality, including a phase of the roadmap | `feature/phase-2-account-sync` |
| `fix/` | a bug fix | `fix/streak-freeze-month-boundary` |
| `chore/` | tooling, dependencies, config, docs | `chore/upgrade-expo-sdk` |
| `release/` | stabilising a version for the stores | `release/v0.2` |

Rules:
- Use lowercase, hyphen-separated names that say *what* the branch does, not who or which tool made it.
- Use one topic per branch. If a branch grows a second topic, split it.
- Name a roadmap phase as `phase-N-topic`. Cite the spec's feature IDs (F2.5, F12.7…) in the PR description, not the branch name.
- Delete the branch once its PR is merged.

## Commits

- Write the subject line in the imperative mood, under about 72 characters ("Add per-field sync merge", not "Added…").
- Use the body to explain *why*, and anything a reviewer can't see in the diff.
- Authorship is the person responsible for the change. Commits are authored by the Velarox account, with no tool co-author trailers.

## Before you push

```bash
cd app && npm test && npx expo lint        # app: logic + sync tests, lint
cd server && .venv/bin/python -m pytest -q  # server: auth, sync merge, metrics
```

Anything that touches the sync format (the outbox, the `records` table, the merge rules) needs a test on **both** sides.

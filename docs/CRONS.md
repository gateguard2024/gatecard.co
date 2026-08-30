# Scheduled jobs

`vercel.json` rejects unknown keys, including `"//"` comments — the notes that
belong with each schedule live here instead.

| Path | Schedule | Why |
|------|----------|-----|
| `/api/sync/brivo` | `*/15 * * * *` | Roster reconciliation. Brivo does not push roster changes, so this is how a move-in is noticed at all. Every 15 minutes because same-day leases exist, and an hourly window means someone stands at a gate that doesn't know them yet. |
| `/api/commissions/release` | `0 9 * * *` | Releases commission entries past their 30-day hold and transfers them to connected accounts. Daily is plenty — the hold is measured in days. |

Both are protected by `CRON_SECRET`. Vercel injects
`Authorization: Bearer $CRON_SECRET` automatically once that env var is set; if
it is unset the routes run unauthenticated, so set it before going live.

**Cron frequency is a paid-plan feature on Vercel.** If `*/15` is rejected on
the current plan, fall back to `0 * * * *` and raise `move_out_grace_hours`
accordingly — the reconciler's confirmation logic is time-based, not run-based,
so a slower cadence stays correct, just less prompt.

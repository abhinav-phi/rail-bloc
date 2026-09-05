# Support

## Where to look first

| Need | Where |
|---|---|
| "How do I run this?" | [MANUAL_STEPS.md](../MANUAL_STEPS.md) |
| "What do I need installed?" | [RAIL_BLOC_Manual_Prerequisites.md](../RAIL_BLOC_Manual_Prerequisites.md) |
| "What does the system do?" | [README.md](../README.md) → [docs/Summary.md](../docs/Summary.md) |
| "What's the architecture?" | [docs/2__TechSpec.md](../docs/2__TechSpec.md), [docs/3__AppFlow.md](../docs/3__AppFlow.md) |
| "What's done vs pending?" | [docs/7__Tracker.md](../docs/7__Tracker.md) — statuses are honest, not aspirational |

## How to ask

1. **Bugs / broken behavior** → open a [bug report](https://github.com/abhinav-phi/rail-bloc/issues/new?template=bug-report.md).
2. **"How do I…?" questions** → open a regular issue with the `question` label; there is no separate chat channel for this project.
3. **Security concerns** → **never** a public issue — use [private advisories](https://github.com/abhinav-phi/rail-bloc/security/advisories/new) (see [.github/SECURITY.md](SECURITY.md)).

When asking about a failure, include the `request_id` returned by the API and the log lines from the relevant service — every request is logged with a correlatable ID.

> Note: this is a SIH26027 project with simulated data only. There is no SLA and no on-call — responses are best-effort by the student team.

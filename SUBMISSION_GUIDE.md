# SIH 2026 Submission Guide — RAIL-BLOC

Use this checklist before sharing the GitHub repository link. Adapted from the
official NSUT-SIH-26 reference template to this repository's monorepo layout.

## Required repository content

- [x] Actual source code is present (`apps/`, `packages/`, `data/`, `migrations/`, `tests/`, `scripts/`).
- [x] `README.md` explains the project clearly.
- [x] PS ID (SIH26027) and PS title are included (see `README.md` → Project Information).
- [x] Problem statement and proposed solution are explained.
- [x] Key features are listed.
- [x] Technology stack is listed.
- [x] Setup and run instructions work (`docker compose up --build`, then `http://localhost:5173`).
- [x] Team members and roles are mentioned (`README.md` → Team).
- [x] Important screenshots are included (`assets/screenshots/`).
- [ ] Final PPT/presentation is placed in `submission/` whenever practical.
- [ ] If the PPT is too large, an accessible Drive/OneDrive viewer link is added to `submission/PRESENTATION.md`.
- [ ] Demo video link added to `submission/DEMO.md` if available (optional but recommended).
- [ ] Repository is accessible to reviewers (must be PUBLIC).

## Recommended structure (this repository)

```text
rail-bloc/
├── README.md
├── SUBMISSION_GUIDE.md
├── submission/
│   ├── PRESENTATION.md
│   └── DEMO.md
├── apps/            # api (FastAPI), web (Next.js), workers (Celery), eval
├── packages/        # core, optima (CP-SAT), sentinel, chronicle, ml
├── data/            # DDL, generators (fixed seeds), seed SQL
├── migrations/      # alembic
├── deploy/          # production compose + Caddy
├── docs/            # PRD, TechSpec, Schema, Tracker, Rules, Summary
├── assets/
│   └── screenshots/
├── tests/
└── scripts/
```

## What goes where

| Item                                   | Location                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------- |
| Source code                            | `apps/` + `packages/` (monorepo layout — `src/` template folded into these) |
| Architecture / technical documentation | `docs/` (PRD, TechSpec, AppFlow, Design, Schema, Rules, Tracker)            |
| Project screenshots                    | `assets/screenshots/`                                                       |
| Final PPT / presentation               | `submission/`                                                               |
| Demo video link                        | `submission/DEMO.md`                                                        |
| Project overview                       | `README.md`                                                                 |

## Presentation

Upload the final PPT/PPTX to `submission/` when the file size is suitable for
GitHub, with a clear filename such as:

`TeamName_SIH2026_Presentation.pptx`

If the PPT is too large for GitHub, use Google Drive or OneDrive and put the
shareable **viewer** link in `submission/PRESENTATION.md`.

## Demo video

The demo video is optional but strongly recommended. Add the YouTube/Google
Drive link to `submission/DEMO.md` and make sure it is accessible without
requesting permission. `docs/DEMO_SCRIPT.md` contains the timed walkthrough the
video follows.

## Do not upload

- Passwords, API keys, access tokens
- `.env` files containing secrets (this repo ships `.env.example` only)
- Private credentials or confidential information

## Before submission

Open the repository in a private/incognito browser window (or logged out) and
verify that reviewers can access the code, PPT, screenshots, documentation and
every submitted link.

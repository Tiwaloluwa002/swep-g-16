# SWEP Group 15 — Obafemi Awolowo University

This repository holds SWEP Group 15's three campus projects for Obafemi Awolowo University, Ile-Ife. Each project is a self-contained web app in its own folder, with its own README, tests and setup.

| Folder | Project | What it does | Status |
| --- | --- | --- | --- |
| [`aacnras/`](aacnras/README.md) | **Accessibility-Aware Campus Navigation and Route Advisory System** | Plans routes across campus for how each person moves (walking, wheelchair, visually impaired, limited mobility), with warnings, an elevation profile, building accessibility details and verified obstacle reports | MVP done |
| [`sctpstvs/`](sctpstvs/README.md) | **Secure Campus Transport Payment and Single-Use Ticket Verification System** | Students pay for campus shuttle rides from a wallet and get signed, single-use QR tickets that conductors scan, so fake or reused tickets are rejected | MVP done |
| [`ppclfmvrs/`](ppclfmvrs/README.md) | **Privacy-Preserving Campus Lost-and-Found Matching and Verified Recovery System** | Matches lost and found reports automatically, and hands items over only after the owner proves ownership, without exposing either side's private details | MVP done |

![AACNRAS route planner](docs/screenshots/route-planner.png)

## Running a project

Every project needs **Node.js 22 or newer**. Run these from the repository root, replacing `<folder>` with the project folder:

```bash
cd <folder>
npm install
npm run dev     # development server
npm test        # unit tests
```

Each project's README covers its demo accounts, configuration, how it works and its limitations.

## Shared conventions

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 and Vitest.
- **Accessible by default:** semantic HTML, labelled controls, visible focus, good contrast, phone-first layouts.
- **No real payments or personal data in demos:** demo accounts, demo wallet top-ups and seed data only.
- **One Postgres database for all three apps.** In production that's Supabase; each app keeps its tables in its own schema (`aacnras`, `sctpstvs`, `ppclfmvrs`) and creates them on first start. Locally, with no `DATABASE_URL`, each app uses PGlite (Postgres in-process) under its git-ignored `data/` folder, so `npm run dev` and `npm test` need no database server.

## Deploying with Supabase

1. Create one Supabase project. Under **Project Settings → Database → Connection string**, copy the **Transaction pooler** URI (port 6543) and put your password into it.
2. Create one host project per app (for example on Vercel, with **Root Directory** set to `aacnras`, `sctpstvs` or `ppclfmvrs`).
3. Set each app's environment variables:

| App | Required | Optional |
| --- | --- | --- |
| `aacnras` | `DATABASE_URL`, `ADMIN_PASSCODE` | `DATABASE_SCHEMA` |
| `sctpstvs` | `DATABASE_URL`, `SIGNING_PRIVATE_KEY` (from `npm run gen-key`) | `DATABASE_SCHEMA`, `TICKET_TTL_MINUTES` |
| `ppclfmvrs` | `DATABASE_URL` | `DATABASE_SCHEMA` |

Every app uses the same `DATABASE_URL`. Each project's README and `.env.example` give the details.

Demo accounts are seeded into production as well, so treat a deployed copy as a test environment.

## Repository layout

```
swep-g-15/
├── README.md        ← this overview
├── docs/            screenshots used in the READMEs
├── aacnras/         accessible campus navigation
├── sctpstvs/        transport payment and single-use tickets
└── ppclfmvrs/       lost-and-found matching and verified recovery
```

## Credits

Built by SWEP Group 15, Obafemi Awolowo University, Ile-Ife, as part of the Students' Work Experience Programme. Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL).

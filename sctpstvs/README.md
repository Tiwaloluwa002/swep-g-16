# SCTPSTVS · Secure Campus Transport Payment and Single-Use Ticket Verification System

A SWEP Group 15 project at Obafemi Awolowo University (OAU), Ile-Ife.

Students pay for campus shuttle rides from a wallet and get a ticket with a signed QR code. Conductors scan it on the bus. Each ticket works once, until it expires, so fake, edited or reused tickets are caught.

> **Demo only.** No real money moves. Top-ups are a labelled demo flow, and the route fares are made-up demo values, not OAU's real fares.

## How to run

You need Node.js 22.13 or later (the app uses the built-in `node:sqlite` module).

```bash
cd sctpstvs
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
```

On first run the app creates `data/` with the SQLite database and the ticket signing key. Both are git-ignored. Delete `data/` to start again from the demo data.

## Features

Working now:

- SQLite data layer (`node:sqlite`) with users, sessions, routes, vehicles, tickets, an append-only wallet ledger and a fraud log.
- Ed25519-signed ticket tokens, backup codes, purchase from the wallet, single-use redemption, expiry and refunds (server code with unit tests).
- Password hashing with scrypt, database-backed sessions and an in-memory rate limiter.
- JSON API for sign-in, wallet and demo top-up, routes, buying tickets, verification (rate-limited, logs fraud), and admin stats, tickets, refunds, fraud log, routes and fares, wallet credits and vehicles.

## Status

Still to come: the student wallet and ticket screens, the conductor scanner, the admin dashboard, and the full README.

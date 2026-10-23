# PPCLFMVRS: Privacy-Preserving Campus Lost-and-Found Matching and Verified Recovery System

A SWEP Group 15 project at Obafemi Awolowo University (OAU), Ile-Ife.

When students lose phones, ID cards, wallets, keys, laptops or bags on campus, finders usually post photos and full details in WhatsApp groups. That exposes the owner's private information and lets anyone falsely claim the item. This system matches lost and found reports automatically. It hands an item over only after the claimant proves ownership, and neither side's private details leak.

## How to run

Requires Node.js 22.5 or later (the app uses the built-in `node:sqlite`).

```bash
cd ppclfmvrs
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
```

## Features

- Pick-lists of OAU item categories, colours and campus locations. Locations have OpenStreetMap coordinates, so "nearby" is worked out from real distances.
- Matching engine: scores lost↔found pairs on category, colour, location, date and description keywords.
- Detection of phone numbers, emails, matric numbers and long serial-like numbers in public text.
- SQLite storage through Node's built-in `node:sqlite` (file in `data/`, ignored by git).
- Accounts keyed by matriculation or staff number, with scrypt-salted password hashes and hashed session tokens.
- Lost reports (with private identifying details kept server-side) and found reports (generic public description, 2–3 verification questions, desk or finder custody).
- Matching on every new report, with in-app notifications to both sides, and a ranked candidate list per lost report.
- Allowlist serializers for every response, plus a guard that throws if a private field, hash or contact detail would be sent.
- Demo seed data with lost and found items that match.
- Claims: the owner answers the finder's questions; on success the server issues a one-time handover code that expires after 72 hours and can be reissued (the old code stops working).
- Handover confirmation by the holding desk (or the finder for items they hold), single-use even under concurrent requests.
- Desk queries: items at a desk, codes awaiting collection, failed-claim log and simple stats.
- Verification answers stored only as normalised, salted scrypt hashes; attempt limits of 3 per claim and 5 per user per day.

## Status

Work in progress. The server-side logic (data, reports, matching, claims, handover, desk queries) is done and unit-tested. Still to come: API routes, QR codes and the user interface.

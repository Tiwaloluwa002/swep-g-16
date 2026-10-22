# AACNRAS

**Accessibility-Aware Campus Navigation and Route Advisory System** for Obafemi Awolowo University, Ile-Ife. SWEP Group 15.

The app plans walking routes across the OAU campus for the way each person actually moves. It avoids steps for wheelchair users, steep slopes for people with limited mobility, and busy roads for visually impaired users. It warns about hazards along the way and lets anyone report obstacles, which an admin then verifies.

## Features

- **Mobility profiles:** standard walking, wheelchair user, visually impaired, limited mobility. Each has its own rules (no steps, at most 8% slope, surface and kerb preferences, speed).
- **Accessible route finding:** A* search over the real campus path network, with costs based on slope, surface, steps, kerbs, tactile paving, traffic and lighting.
- **Route advisory:** turn-by-turn directions with warnings for steps, slopes, rough ground and reported obstacles, plus places to rest on the way.
- **Building accessibility info:** step-free entrance, ramp, lift and accessible toilet for each building.
- **Obstacle reports:** anyone can report a blocked path, flooding, construction or a broken lift. A pending report shows as a warning on routes; once an admin verifies it, routes avoid that path.
- **Admin dashboard** (`/admin`) to verify, reject or resolve reports.
- **Accessible interface:** high-contrast mode, three text sizes, directions read aloud, full keyboard use, screen-reader labels and the Atkinson Hyperlegible font.
- **After-dark mode** that prefers lit paths.

## Running it

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # routing tests
```

To test on phones on the same Wi-Fi network:

```bash
npm run build
npx next start -H 0.0.0.0 -p 3015   # then open http://<this computer's IP>:3015
```

The admin passcode is `oau-swep-15`. Set `ADMIN_PASSCODE` in `.env.local` to change it.

## Where the data comes from

| Data | Source | Status |
| --- | --- | --- |
| Paths, roads, steps | OpenStreetMap (`src/data/osm-network.json`) | Real, but footpaths near some buildings are missing |
| Slopes | Copernicus 90 m terrain model via Open-Meteo | Estimates; short steep sections can be missed |
| Building positions | OpenStreetMap | Real |
| Building accessibility | — | **Not surveyed yet** |
| Rest points (benches, shelters) | — | **Not surveyed yet** |

Run `npm run import:osm` to refresh the network from OpenStreetMap.

## Survey checklist (group fieldwork)

1. For each building in `src/data/campus.ts`, check the step-free entrance, ramp, lift and accessible toilet, and fill in its `accessibility` values.
2. Walk the main routes and correct slopes, steps, surfaces and kerbs in `pathCorrections`, keyed by OpenStreetMap way id. Hover a path on the map, or look in `osm-network.json`, to find the id.
3. Add benches and shelters to `restPoints`.
4. Where directions say "this stretch is not on the map yet", map the missing footpath in OpenStreetMap ([openstreetmap.org](https://www.openstreetmap.org)), then run `npm run import:osm`.
5. Set `DATA_VERIFIED = true` when you're done.

## Project layout

```
src/
  app/                 pages (route planner, /admin) and API routes (/api/reports)
  components/          map, route planner, report form, settings
  data/                campus places, path corrections, imported OSM network
  lib/
    routing.ts         A* search and per-profile edge costs
    advisory.ts        turn-by-turn directions and warnings
    profiles.ts        mobility profile rules
    graph.ts           graph building and spatial lookups
    server/            report storage (JSON file) and admin check
scripts/import-osm.mjs OpenStreetMap + elevation importer
```

Reports are stored in `data/reports.json`. That works for demos on a single server; use a database before deploying to serverless hosting.

Map data © OpenStreetMap contributors (ODbL).

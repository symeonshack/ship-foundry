---
name: verify
description: Build, launch, and drive Ship Foundry end-to-end in headless Chromium to verify changes at the real surface (canvas + DOM HUD).
---

# Verifying Ship Foundry

Browser game (three.js canvas + DOM overlay HUD). Verification = drive it in headless Chromium via Playwright (devDependency; chromium already installed via `npx playwright install chromium`).

## Launch

```powershell
npm run dev          # background; serves http://localhost:5173
```

`npm run build` runs `tsc --noEmit` first; `npx vitest run` covers pure logic (stats, refinery, GERTY, encounter constraints) — CI hygiene, not verification.

## Drive

A known-good driver exists in past session scratchpads (`drive.mjs`); recreate from this recipe:

- In dev mode `window.__game = { ctx, manager }` is exposed (see end of `src/main.ts`). Use it to *find* 3D click coordinates, then dispatch **real** `page.mouse.click`s — don't mutate state except for fixtures.
- Project world→pixels with the active screen's camera (`manager.active.camera`): apply `matrixWorldInverse` then `projectionMatrix` manually (THREE isn't a page global). Guard `w < 0` (behind camera) and off-viewport points before clicking.
- **Fresh save:** the `beforeunload` handler re-saves during reload. To truly reset: `localStorage.clear(); Storage.prototype.setItem = () => {};` then `page.reload()`.
- DOM surfaces: palette items `.part-item`, panel buttons in `#panel`, nav in `#nav`, GERTY box `#gerty` (`.decline` class + "UNABLE TO COMPLY" name for decline states), toasts `.toast`, logbook modal `.log-entry`.
- 3D click targets: shipyard socket markers `manager.active.markers` (get pixel via matrixWorld elements 12/13/14); surface deposit nodes `manager.active.nodeMeshes.get(id)` with ids from `store.state.pois.<id>.nodes`; star-map markers `manager.active.markers.get(poiId)` — far POIs (signal) need `page.mouse.wheel` zoom-out before they're on-screen.
- Encounter sockets sit at `SOCKETS[i] * 1.7` on plane y≈0.66; collaborator turn resolves ~1.3s after a player action — wait ≥2.5s between moves. Known solution: conduit @ socket 6, conduit @ 2, emitter @ 0; collaborator supplies 7, 3, damper.
- Endgame fixture (skip the grind): `store.addStock(...)`, push placements (`hullL` on `p1` socket 0; `sensor2`/`tank`s on its utility sockets), set `state.fuel`, then `store.changed()`.

## Interior (Phase 1)

- The game starts on the `interior` screen (first-person). Drive it with real key events: `KeyW/A/S/D` move, arrows look — but timed turns are unreliable under headless frame rates (`dt` clamps at 0.1s). Instead aim via the debug handle (`manager.active.controller.yaw = atan2(-dx, -dz)`) and walk with W-key bursts, polling `controller.position`.
- Hotspots (interact radius 2.2): star-map table (0,-2.5), GERTY console (3.6,-0.5), rear hatch (0,4.9). `#interact-prompt` shows `[E] …` in range; `page.keyboard.press('KeyE')` triggers.
- Aboard, GERTY speaks via `#gerty-bubble` (`.decline` class for refusals); the `#gerty` comms box only appears off-ship. GERTY queues lines with a busy window (long lines block ~12s) — `gerty.ask(topic)` jumps the queue.
- Nav: no STAR MAP button; map opens only from the table console. Travel always lands on `interior`; the hatch exits by context.

## Flight (Phase 2)

- Travel opens the `flight` screen; state (fuel, currentPoi) commits at launch, `travel:arrive` fires only at touchdown. Drive with real keys: W/S throttle, A/D steer, hold Space to brake on descent. Starter ships need braking from the start of descent to land soft.
- Screen internals via `manager.screens.get('flight')`: `.phase` ('cruise'|'descent'|'touchdown'), `.journey.progress`, `.descent.{altitude,velocity}`, `.hardLanding`. Dev mode adds an "Autopilot (dev)" panel button that lands instantly.
- Reload mid-flight boots already-arrived aboard (by design; that hop's arrive-triggered GERTY line/fragment is skipped).

## Gotchas

- GERTY lines queue with cooldowns; ambient lines can lag their trigger by several seconds — assert on state/log, not on which line is currently showing.
- Extraction is real-time (~0.9/s); filling the 6-unit starting hold takes ~8s. Refining: 4–10s per unit.
- Watch `page.on('console'/'pageerror')` — a clean run has zero errors.

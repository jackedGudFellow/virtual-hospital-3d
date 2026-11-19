# Architectural & Design Decisions

## Tech Stack
- **Vite + TypeScript + Vanilla Three.js** (`three` + `three/examples/jsm` `OrbitControls` & `CSS2DRenderer`): Chosen over React Three Fiber to minimize bundle size, keep frame-loop overhead near zero for 60 fps on mid-range laptops/phones, and maintain clean separation between Three.js scene modules (`/src/core`, `/src/world`, `/src/rooms`) and lightweight DOM HUD modules (`/src/ui`).
- **Static-only architecture:** No backend; all building, room-type, equipment, and drug data will live in `/src/data/*.json`.
- **Procedural geometry & textures:** No external paid assets; all meshes and canvas-generated labels/textures are created in code.

## Reference Drawings
- Saved in `/reference/`:
  - `drawing-a-nicu.jpg`: Medical City Medical Hospital (NICU-style single-floor plan, ~22.20 m x 15.43 m, grid A–D / 1–5).
  - `drawing-b-oncology-bmt.jpg`: Multi-floor oncology & bone-marrow-transplant hospital design (First, Second, Third, Typical floors + 6 isometric unit drawings).
- **Pharmacy placement:** Per project brief, Drawing B only lists a small pharmacy in the BMT area; a full public-facing Pharmacy + back-of-house Storage Room will be designed on L1 beside the main lobby, while retaining the satellite chemo/cytotoxic drug preparation room.

## Core Architecture
- Every clickable 3D object carries a stable `userData.id` string (e.g., `L1.pharmacy.cabinet-A.shelf-2.slot-3`).
- Explicit interaction modes (`EXTERIOR` -> `FLOOR` -> `ROOM` -> `ITEM`) managed by `StateStore` and `EventBus`.

## Phase 2: L1 Floor Plan Assumptions
- **Overall L1 footprint:** `56 m x 60 m` (inferred from Drawing B's First Floor proportions relative to standard surgical/ICU bay widths and the `22.2 m x 15.4 m` Drawing A NICU reference). Floor-to-floor height `3.8 m` (`3.5 m` clear wall height + `0.3 m` structural slab).
- **Wing & courtyard layout:** North-West wing (`x: 0..18, z: 0..22`), open North Courtyard (`x: 18..32, z: 0..16`), North Lifts & Stairwell (`x: 18..32, z: 16..22`), North-East wing (`x: 32..56, z: 0..22`), Central Surgery/Sterilization/Services/Storage core (`z: 26..42`), and South Entrance/Lobby/Chemotherapy/Pharmacy/Cafeteria wing (`z: 46..60`).
- **Pharmacy placement:** Public-facing `Pharmacy — Dispensing` (`9 m x 14 m`) is placed directly beside the `Main Lobby & Entrance` and `Main Waiting Area` on L1. `Pharmacy — Storage Room` (`14 m x 9 m`) sits just north across the south spine corridor, sharing a wall and pass-through connection with `Cytotoxic Drug Preparation` (`14 m x 7 m`).
- **Shared-wall openings:** `BuildingBuilder` aggregates all door and window openings on a floor so adjacent rooms automatically receive matching cutouts on shared walls without duplicating door entries in `hospital.json`.

## Phase 3: Multi-Floor & NICU Wing Assumptions
- **NICU wing placement (Drawing A):** Placed on **L2 East** (`x: 56..82, z: 0..16`, `22 m x 16 m` main block matching Drawing A's `22.20 m x 15.43 m` footprint) with a `4 m` connection corridor and `4 m x 4 m` "NICU Upper Floor Connection Shaft" linking into L2's NE corridor.
- **Typical floor reuse (L4–L5):** `L5` references `"templateFrom": "L4"` in `hospital.json`; `BuildingBuilder` clones L4's footprint and rooms and rewrites the `L4.` ID prefix to `L5.`.
- **Vertical circulation:** `North Lifts & Stairwell` (`x: 18..32, z: 16..22`) is aligned across L1–L5 with procedural elevator shafts and 12-step staircases built on every floor.

## Step 0: Baseline
- Created branch `step-00-baseline` from clean `main` (`d34362c`).
- Verified baseline `npm run typecheck`, `npm run build` (`dist/` = `0.72 MB`, JS = `736.36 kB` / gzip `187.41 kB`), and `npm run qa` (153 rooms across 5 floors, 120 drugs across 12 cabinets) without running `npm ci` over network because `node_modules` was already freshly installed from `package-lock.json`.
- Interactive browser smoke checks are tracked honestly as `PENDING MANUAL / STEP 5 E2E` in `docs/SMOKE_TEST.md` until run in a live browser or automated with Playwright in Step 5.

## Step 1: Startup Robustness & Page Basics
- Removed `maximum-scale=1.0, user-scalable=no` from `index.html` viewport meta so pinch-zoom works on page chrome; added `touch-action: none` on `#canvas-container` to prevent unwanted browser scroll/zoom during 3D orbit gestures.
- Added an inline SVG data-URI favicon (zero external network requests), `<noscript>` fallback, meta description, `theme-color`, and Open Graph tags.
- Guarded `THREE.WebGLRenderer` creation in `Engine.ts` with a preflight `webgl2`/`webgl` context check and `try/catch`, plus `webglcontextlost`/`webglcontextrestored` handlers in `main.ts`.
- Split `bootstrap()` into 5 async stages separated by `requestAnimationFrame` + `setTimeout(0)` (`nextFrame()`) with a 20-second startup watchdog so the progress bar visibly paints and never hangs silently.

## Step 2: Layout & Data Corrections
- **Surgery overlap fix:** Adjusted `L1.surgery.mri` from `d: 9` to `d: 8` (`z: 26..34`) and `L1.surgery.control` from `z: 35, d: 7` to `z: 34, d: 8` (`z: 34..42`), eliminating the `x: 20..21, z: 34..35` overlap with `L1.surgery.post-op`.
- **Pharmacy connectivity:** Swapped `L1.pharmacy.storage` (`x: 42..56, z: 34..42`) and `L1.chemo.cytotoxic-prep` (`x: 42..56, z: 26..34`) so `Pharmacy — Storage` sits directly across the 4 m south corridor from `Pharmacy — Dispensing` (`x: 38..47, z: 46..60`) with aligned staff-only doors (`x: 43.5..44.9`), while keeping the direct pass-through door (`z = 34`) between Storage and Cytotoxic Prep and keeping the public dispensing window facing the Main Lobby.
- **L3 reachability fix:** Added a south door on `L3.psychology.eating-body` linking `L3.circulation.spine-main` to `L3.circulation.spine-south` so all 5 South L3 rooms (`one-to-one`, `spine-south`, `hydrotherapy`, `massage`, `consultant`) are reachable from `L1.main.lobby`.
- **Drugs & Sources:** Fixed `aprepitant-125-cap` (`form: "Capsule"`, `strength: "125 mg / 80 mg (3-day pack)"`), added verified `scheduleByCountry.US` (DEA Schedules II/III/IV) to Cabinet K controlled drugs, and updated `docs/SOURCES.md` to WHO EML 24th Edition (Sept 2025) + 10th EMLc + DEA CSA.

## Step 3: Walk Collision
- Replaced the door-radius proximity shortcut in `CameraRig.ts` with pure circle-vs-wall-segment and circle-vs-AABB furniture collision (`resolveCircleMovement` in `HospitalIndex.ts`) using deduplicated floor wall segments with real door gaps.
- Derived furniture collision AABBs for large fixtures (beds, OR tables, MRI gantry, reception desks, conference tables, hydrotherapy pool, pharmacy counter/cabinets/racks) from `room.type` & `room.bounds` without modifying visual builders owned by later steps.
- Click-to-walk now routes between rooms via BFS door waypoints (`computeDoorPath`) instead of walking straight into walls.
- Added pure-logic unit tests in `tests/walk-collision.test.ts` runnable directly with Node v26 `node --test` (keeping `package.json` untouched until Step 5).

## Step 4: Performance & Quality Settings
- Auto-detects Low quality on touch/small/low-RAM/low-core devices or when the first 2 seconds average `< 30 fps`; persists manual user choice in `localStorage` (`vh3d.quality`, wrapped in `try/catch`).
- Reuses a single `EffectComposer` and refreshes `composer.setPixelRatio`/`setSize`, `renderer.shadowMap.needsUpdate`, `DirectionalLight.castShadow`, and `material.needsUpdate` on toggle without leaking GPU resources.
- Hooked `BuildingBuilder`'s distance-based CSS2D label culling via `root.userData.updateLabels(camPos)` invoked by `Engine` so `src/main.ts` remains untouched.
- Pauses `requestAnimationFrame` on `document.visibilitychange` when hidden and caps touch DPR at `1.5`.

## Step 5: Automated Tests & CI
- Added `vitest` for pure-logic unit tests (`tests/unit/hospital.test.ts`, superseding `tests/walk-collision.test.ts`) and `@playwright/test` for headless WebGL E2E tests (`tests/e2e/hospital.spec.ts`) using SwiftShader ANGLE flags.
- Added the read-only/navigation `window.__hospitalTest` hook gated strictly behind `?test=1` in `src/main.ts` as specified in Step 5 Task 2.
- Added `.github/workflows/ci.yml` and updated `.github/workflows/deploy.yml` so GitHub Pages deploys only after `typecheck`, `build`, `qa`, `test:unit`, and `test:e2e` all pass.

## Step 6: Accessibility & Full EN/AR i18n
- Extracted UI strings and department names into `src/locales/en.json` and `src/locales/ar.json` with `localStorage` persistence (`vh3d.lang`), `<html lang dir>` switching, and a Vitest parity test (`tests/unit/i18n.test.ts`).
- Isolated Latin drug names and numeric strengths with `<bdi dir="auto">` for clean RTL rendering.
- Added ARIA landmarks (`role="region"`, `role="navigation"`, `role="dialog"`), `#sr-announcer` live announcements, modal focus return, arrow-key navigation on Pharmacy cabinet pills, `@media (prefers-reduced-motion: reduce)`, and `@axe-core/playwright` verification (`tests/e2e/a11y.spec.ts`).

## Step 7: Navigation & UX
- **Shareable URLs:** `StateStore` encodes `floor`, `room`, and `mode` into `window.location.hash` via `history.replaceState`; `Hud` restores hash state on startup and provides a `#btn-copy-link` button.
- **Unified Search:** `SearchBox` returns grouped results for Rooms, Medications (jumping into `L1.pharmacy.dispensing`, highlighting, and opening the drug inspect panel), and Equipment (flying to a room containing that equipment).
- **Minimap Floor Tabs:** Added `L1`–`L5` tabs inside `Minimap` alongside clickable room footprints.
- **Onboarding & Touch:** Added 3-step dismissible coach marks in `Onboarding.ts` (persisted via `vh3d.onboardingDone`, skipped under `?test=1`) plus 550ms touch long-press on the canvas to enter a selected room.

## Step 8: Fidelity to the Drawings
- **Reference Drawing Overlay:** Added a semi-transparent textured plane in `BuildingBuilder.ts` loading `reference/drawing-b-oncology-bmt.jpg` and `reference/drawing-a-nicu.jpg` via Vite URL imports, controlled by a Settings toggle (`Plan Overlay`) and opacity/scale/X/Z sliders via `vh3d:plan-overlay` CustomEvent (keeping `main.ts` and `Events.ts` untouched).
- **Isometric & NICU Interiors:** Rebuilt `bmt-isolation` (anteroom glass partition + private balcony rail + HEPA + sink), `ward-single`/`ward-double` (en-suite toilet + sink + privacy curtain), `ophthalmic` clinic (exam bed + privacy curtain + desk + sink), `mri`/`control-room` (lead-glass observation window), `chemo-bay` (side table beside every recliner), `nicu-station` (4 distinct workstations), and dirty-utility `sluice-sink`, with every new item clickable in `equipment.json`.
- Skipped optional "plan vs 3D" compare slider to keep scope crisp and avoid overlap.

## Step 9: Pharmacy Upgrades
- Added `src/data/pharmacyScenarios.json` with 5 educational dispensing-verification scenarios (LASA traps, dosage-form verification, and expired-batch quarantine; patient is always `Sample Patient` with no dosing instructions).
- Added deterministic simulated stock/batch/expiry metadata (`getSimulatedStock`), Low Stock / Near Expiry badges, `scheduleByCountry` display, fridge out-of-range alert toggle (`4.2 °C` / `11.4 °C ALERT`), Controlled-Drug access log, side-by-side Compare modal, and filter pills (`All`, `Refrigerated`, `Controlled`, `Antibiotics`).
- Upgraded `PharmacyDrugMesh.ts` with distinct shared-geometry procedural shapes per form (blister carton, bottle with neck/cap, metallic crimp-cap vial, L-shaped MDI inhaler with canister, IV pouch with port, injector pen, ointment tube).













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



# Project Roadmap

- [x] **PHASE 1: Foundation** — Vite+TS project, Engine, scene with soft sky/ground, lighting, orbit camera, resize handling, StateStore, event bus, empty HUD shell, README, DECISIONS.md, ROADMAP.md.
- [x] **PHASE 2: Data model + floor plans to 3D walls** — Author `hospital.json` for L1, BuildingBuilder/RoomBuilder (slabs, walls with door/window openings, department floor colors, ceiling toggle, top-down 2D camera preset).
- [x] **PHASE 3: All floors + building exterior** — Author L2 (BMT + activities + AR + NICU wing), L3 (admin/education/psychology/physio), typical inpatient floors (L4-L5), stairs, lifts, corridors, courtyard, façade, roof, and floor switcher UI (whole/exploded/isolate).
- [x] **PHASE 4: Click, highlight, info, fly-in** — Picker hover/click, InfoPanel, double-click / "Enter room" fly-in through doors, first-person walk mode with wall collision (desktop + mobile), Esc/Back navigation, breadcrumb, minimap, search box.
- [x] **PHASE 5: Interiors** — Procedural `Furniture.ts` & `equipment.json` for inpatient wards, BMT isolation room, clinic, CT scan room, chemo chair place, NICU bays/nurse station/milk prep/utilities, OR, ICU, waiting, reception, cafeteria, lobby, plus signage.
- [x] **PHASE 6: The Pharmacy** — Public dispensing window + mini-interaction, back-of-house storage room + hatch to chemo prep, 12+ cabinets with >=120 real drugs (`drugs.json` + `/docs/SOURCES.md`), click-to-inspect, pharmacy search, fridge & locked controlled cabinet behaviors.
- [x] **PHASE 7: Polish, atmosphere, accessibility** — Day/night toggle, optional ambient sound, NPC corridor silhouettes, animated doors/lifts, ceiling lights/reflections, optional SSAO/bloom + Low quality toggle, guided tour, keyboard nav, ARIA, high-contrast, EN/AR RTL scaffold.
- [x] **PHASE 8: QA, performance, deploy** — Room click/enter verification script, mobile viewport QA, bundle size < 15 MB, Lighthouse pass, loading screen, final docs & deploy instructions.

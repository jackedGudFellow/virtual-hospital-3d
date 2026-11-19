# Performance Budget & Measurements

**Measured on branch `step-04-perf-and-quality`** (2026-11-19)

## Build Bundle Size (Measured)
- `dist/index.html`: ~2.26 kB
- `dist/assets/index-*.css`: ~15.82 kB (gzip ~3.45 kB)
- `dist/assets/index-*.js`: ~745 kB (gzip ~190 kB)
- Total `dist/` size: **0.73 MB** (budget: `< 15 MB`)

## Runtime Performance Architecture
- **Auto-Quality Detection:** Automatically starts in **Low Quality** on touch devices, small viewports (`< 768px`), low-memory (`<= 4 GB`), or low-core (`<= 4` threads) devices, and downgrades to Low if the first 2 seconds average `< 30 fps`. User choice is persisted in `localStorage` (`vh3d.quality`).
- **Low Quality Mode:** Disables `EffectComposer` / `UnrealBloomPass`, disables shadow maps (`renderer.shadowMap.enabled = false`, `DirectionalLight.castShadow = false`, `material.needsUpdate = true`), and sets pixel ratio to `1.0`.
- **High Quality Mode:** Caps pixel ratio at `1.5` on touch devices and `2.0` on desktop; reuses a single `EffectComposer` across toggles (zero leak).
- **Tab Visibility Pause:** Pauses `requestAnimationFrame` when `document.hidden === true`.
- **CSS2D Label Culling:** Zero DOM labels rendered in Whole/Exploded views (`display: none`); in Isolate view, labels beyond `42 m` from camera are hidden and fade between `22 m` and `42 m`.

## Live GPU Metrics (FPS / Draw Calls / Frame Time)
- Not measured in this terminal-only session (no GPU browser attached). Runtime draw-call and frame-time budgets will be captured and enforced in **Step 5 (Playwright E2E + CI gates)** and **Step 12 (Final regression)**.

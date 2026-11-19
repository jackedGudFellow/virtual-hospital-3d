# Manual Smoke Test Checklist

**Baseline commit:** `d34362c` (branch `step-00-baseline`)
**Date:** 2026-11-19
**Build artifacts measured:**
- `dist/index.html`: 0.94 kB (gzip 0.45 kB)
- `dist/assets/index-C_bCibVv.css`: 14.69 kB (gzip 3.27 kB)
- `dist/assets/index-BbPkRDZo.js`: 736.36 kB (gzip 187.41 kB)
- Total `dist/` size: **0.72 MB**

> **Verification note:** Automated checks (`npm run typecheck`, `npm run build`, `npm run qa`) all **PASSED** on this baseline. Interactive browser checks below were **not executed** in this terminal-only session and are marked `PENDING MANUAL / STEP 5 E2E` rather than guessed.

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | Exterior view renders (L1–L5 + NICU wing, grounds, ambulance, clouds) | PENDING MANUAL / STEP 5 E2E | Verified build succeeds cleanly |
| 2 | Floor switch (`All`, `Split`, `L1`–`L5`) animates smoothly | PENDING MANUAL / STEP 5 E2E | Code present in `BuildingBuilder.ts` / `Hud.ts` |
| 3 | Click room shows `InfoPanel`; double-click / Enter frames room | PENDING MANUAL / STEP 5 E2E | Code present in `Picker.ts` / `CameraRig.ts` |
| 4 | Walk mode (`WASD`, click-floor-to-glide, wall collision) | PENDING MANUAL / STEP 5 E2E | Known limitation: door-radius shortcut (scheduled for Step 3) |
| 5 | Open Pharmacy (`L1.pharmacy.dispensing`) via Quick Jump / Search | PENDING MANUAL / STEP 5 E2E | Known layout issue: Storage is disconnected across corridor (Step 2) |
| 6 | Open cabinets `A`–`L` (and unlock `K` via Pharmacist Badge) | PENDING MANUAL / STEP 5 E2E | 12 cabinets + 120 drugs verified in `npm run qa` |
| 7 | Inspect a drug (3D preview, Prev/Next, disclaimer visible) | PENDING MANUAL / STEP 5 E2E | Known data issue: `aprepitant-125-cap` form mismatch (Step 2) |
| 8 | Search bar finds rooms and flies to selection | PENDING MANUAL / STEP 5 E2E | Unified room+equipment+drug search scheduled for Step 7 |
| 9 | Guided Tour plays, advances, and skips cleanly | PENDING MANUAL / STEP 5 E2E | 7-stop tour implemented in `GuidedTour.ts` |
| 10 | EN/AR language toggle switches text & RTL layout | PENDING MANUAL / STEP 5 E2E | Full UI/data localization scheduled for Step 6 |
| 11 | Low Quality toggle disables bloom/shadows and improves FPS | PENDING MANUAL / STEP 5 E2E | Known issue: `material.needsUpdate` & composer resize fix in Step 4 |

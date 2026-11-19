# Interactive 3D Virtual Hospital

An educational, browser-based 3D hospital explorer built with **Vite + TypeScript + Three.js**.
Visitors can inspect the entire 5-floor hospital + NICU wing in 3D, switch/explode/isolate floors, click and enter any room in first-person walk mode, inspect medical equipment, and explore a full **Pharmacy** with 120 real-world medications across 12 cabinets.

> **Disclaimer:** Educational simulation only. Not a clinical tool or medical advice.

## Local Development

```bash
npm install
npm run dev
```

## Production Build & QA

```bash
npm run build
npm run qa
```

`npm run build` outputs a static bundle to `dist/` (< 1 MB). `npm run qa` verifies all room IDs across L1–L5, room types, department mappings, `drugs.json` (120 drugs across 12 cabinets), and `dist/` bundle size.

## Controls & Features
- **Orbit / Zoom / Pan:** Left-drag to orbit, scroll to zoom, right-drag to pan.
- **Floor Switcher:** `Whole`, `Exploded`, or `L1`–`L5` isolate.
- **Click / Double-click Room:** Click to view room info; double-click (or click **Enter Room**) to fly through the door into first-person walk mode (`WASD`/Arrows + drag, or touch joystick on mobile).
- **Pharmacy (L1):** Click cabinets `A`–`L`, unlock Controlled Cabinet `K` with the mock Pharmacist Badge, click any medication to inspect & rotate its 3D package, search drugs, or click the Dispensing Window to simulate a prescription.
- **Shortcuts & Accessibility:** `Esc` (back one level), `~` (FPS/draw-call overlay), `?` (How to Explore guide), **Day/Night**, **Sound**, **Quality: High/Low**, **High Contrast**, and **EN/AR (RTL)**.

## Deploy (Static Host)

- **Netlify:** Connect the repo with build command `npm run build` and publish directory `dist`, or drag-and-drop `dist/` in Netlify Drop / `npx netlify-cli deploy --prod --dir=dist`.
- **Vercel:** Run `npx vercel --prod` (framework preset: Vite, output directory: `dist`).
- **GitHub Pages:** Build with `npm run build` (`vite.config.ts` already sets `base: './'`) and publish the `dist/` folder to the `gh-pages` branch.

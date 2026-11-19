# Backlog

Items discovered outside the current step's file ownership are logged here with their target step, file, and a one-sentence description.

- **Step 1** (`index.html`): Viewport meta currently includes `maximum-scale=1.0, user-scalable=no`, which blocks browser pinch-zoom on UI chrome.
- **Step 2** (`src/data/hospital.json`): `L1.surgery.post-op` (`x: 13..21, z: 34..42`) overlaps `L1.surgery.mri` (`x: 20..28, z: 26..35`) on the `x: 20..21, z: 34..35` corner.
- **Step 2** (`src/data/hospital.json`): `L1.pharmacy.storage` (`z: 26..35`) is separated from `L1.pharmacy.dispensing` (`z: 46..60`) across the south corridor without a direct staff-only route.
- **Step 2** (`src/data/drugs.json`): `aprepitant-125-cap` has `form: "Box"` instead of a consistent capsule/pack id and form.
- **Step 3** (`src/core/CameraRig.ts`): Walk collision uses a door-radius proximity shortcut rather than true circle-vs-wall-segment and furniture collision.
- **Step 4** (`src/core/Engine.ts`): Quality toggle does not refresh `material.needsUpdate` or `composer.setPixelRatio` / `setSize` after toggling shadows and DPR.

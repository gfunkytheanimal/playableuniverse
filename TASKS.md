# Playable Universe — Improvement Tasks

Tasks ordered by leverage. Each is independent — pick any order, or do them in sequence as listed. Run `npm run build` after each task as a smoke check (there is no test suite).

---

## Project orientation (read first)

- Single-page Vite app, vanilla JS (no TypeScript), ES modules.
- Renderer: PlayCanvas Engine 2.18. GUI: lil-gui.
- Entry: `src/main.js`. HTML shell: `index.html`.
- Default user-facing mode: **piano physics** — 12 chromatic note families, each owning a persistent subset of particles with its own color, sprite, mass, stiffness, and damping.
- Particle simulation runs on CPU by default. WebGPU compute path is opt-in via `?webgpu=1&gpu=1` and is currently known to render black; treat it as triage-only, not production.
- **State pattern to be aware of:** a single mutable object built by `createDefaultParams()` in `src/systems/params.js` holds ~210 keys. Most systems both read from and write to it. Treat this as the convention for now — Task 3 begins separating it, but do not introduce parallel state stores until then.
- No tests. The fastest smoke check is `npm run build`; it currently succeeds in ~11s and produces one ~2.3 MB chunk (~604 KB gzipped).
- Project owner is Greg ("G Funky"). He prefers direct, terse output. No need to over-explain choices in commit messages or PR descriptions.

---

## Task 1 — Fix pointer capture in VirtualPiano

**Priority:** HIGH. Real defect, localized fix.

**File:** `src/ui/VirtualPiano.js`

**Problem:** Notes can hang. If the user presses a key with the mouse, drags off, and releases elsewhere, `pointerup` fires on a different element and `noteOff` never runs. Also: dragging across keys (glissando) does not play subsequent keys.

**Cause:** The current code attaches `pointerdown` / `pointerup` / `pointerleave` to each button without calling `setPointerCapture`. Once the pointer leaves the button, the button stops receiving its events.

**Fix:** Replace the listener setup in `build()` with capture-aware handlers and add slide-to-play across neighbors.

Current code (around lines 39–46):

```js
for (const button of this.element.querySelectorAll('button')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    this.noteOn(button.dataset.note, 1);
  });
  button.addEventListener('pointerup', () => this.noteOff(button.dataset.note));
  button.addEventListener('pointerleave', () => this.noteOff(button.dataset.note));
}
```

Replace with:

```js
for (const button of this.element.querySelectorAll('button')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    this.noteOn(button.dataset.note, 1);
  });
  button.addEventListener('pointerup', (event) => {
    if (button.hasPointerCapture(event.pointerId)) {
      button.releasePointerCapture(event.pointerId);
    }
    this.noteOff(button.dataset.note);
  });
  button.addEventListener('pointercancel', () => {
    this.noteOff(button.dataset.note);
  });
  // Slide-to-play: trigger on enter only while a pointer is already pressed.
  button.addEventListener('pointerenter', (event) => {
    if (event.buttons > 0 && !this.active.has(button.dataset.note)) {
      this.noteOn(button.dataset.note, 0.85);
    }
  });
  button.addEventListener('pointerleave', (event) => {
    if (event.buttons > 0) {
      this.noteOff(button.dataset.note);
    }
  });
}
```

**Acceptance:**
- Mouse-press a key, drag off the keyboard, release: note stops.
- Mouse-press a key, drag onto the next key: first releases, second triggers.
- Touch-press a key, slide across multiple keys: glissando plays.
- `npm run build` still passes.

---

## Task 2 — Git hygiene

**Priority:** LOW effort, HIGH cleanliness payoff.

**Files:** `.gitignore`, repo root.

**Steps:**

1. Replace `.gitignore` contents with:

```
node_modules/
dist/
.env
*.log
.DS_Store
.vscode/
.idea/
```

2. Untrack the log files that are currently committed:

```
git rm --cached dev-server.err.log dev-server.out.log vite.err.log vite.log
```

3. **Stop and ask Greg before touching the MP3s.** `public/Demon.mp3` (6.2 MB) and `public/Latido.mp3` (5.5 MB) are committed. The README never references them. Two options:
   - If they are demo samples meant to ship: leave them in place but recommend Git LFS (`git lfs track "*.mp3"`).
   - If they were local test material: `git rm` them and add `public/*.mp3` to `.gitignore`.

   Do not delete without confirmation.

**Acceptance:**
- `git status` after build is clean.
- New `.gitignore` is in place.
- A decision is recorded for the MP3s.

---

## Task 3 — Segment the params object (structural)

**Priority:** HIGH leverage. Do this before Task 4 or Task 6.

**File:** `src/systems/params.js` (currently 212 lines, ~210 flat keys).

**Goal:** Group keys by role *without* changing the public shape. Every existing consumer reads `params.someKey`. Do not break that. This is preparation for future tightening, not the tightening itself.

**Approach:**

1. Create `src/systems/paramGroups.js` with four exported factory functions:
   - `createViewParams()` — camera + UI + zoom + view labels. Examples: `cameraYaw`, `cameraPitch`, `cameraDistance`, `targetCameraDistance`, `viewDepth`, `zoomDepth`, `viewLabel`, `cameraState`, `focusRingIndex`, `focusNodeIndex`, `cameraPanX`, `cameraPanY`, `tunnelTightness`, `uiVisible`, `diagnosticsVisible`, `recordingMode`, `posterMode`, `inputDebugVisible`, `mouseX`, `mouseY`, `pointerMoves`, `dragging`, `wheelDelta`, `heroMode`.
   - `createAudioState()` — fields written by `AudioReactiveSystem` and read by everyone else. Examples: `audioEnabled`, `audioPermission`, `audioRms`, `audioPulse`, `audioOnset`, `audioCentroid`, `audioImpulse`, `audioSynthetic`, `audioEnergy`, `audioNoiseFloor`, `audioOnsetCount`, `audioHitType`, `audioEvents`, `audioBandEvents`, `audioBandVariance`, `audioDominantBand`, `audioEventHistory`, `audioSub`, `audioBass`, `audioLowMid`, `audioMid`, `audioHighMid`, `audioTreble`, `audioLevel`, `audioBands`, `audioBandOnsets`, `detectedNote`, `detectedNoteConfidence`, `proceduralAudio`, `liveInstrumentEstimate`.
   - `createSimParams()` — user-tunable simulation knobs that appear in the GUI. Examples: `particleCount`, `timeScale`, `integrationStep`, `fieldStrength`, `recursiveStrength`, `travelSpeed`, `particleSize`, `dotOpacity`, `trailOpacity`, `trailPersistence`, `trailWidth`, `trailStyle`, `trailHistory`, `trailStrength`, `bloomStrength`, `fogDensity`, `chromaticAberration`, `volumetricDensity`, `volumetricScale`, `memoryInfluence`, `structureInfluence`, `audioReactivity`, `audioSensitivity`, `onsetSensitivity`, `visualReactivity`, `universeScale`, `clusterDensity`, `collisionStrength`, `particleTransfer`, `interactionStrength`, `cosmicGlow`, `cloudDensity`, `particleEnergy`, `masterVolume`, `synthVolume`, `noteInstrument`, `noteLayout`, `nodeCount`, `ringInstanceCount`, `quality`, `preset`, `presetLabel`, `appMode`, `primaryMode`, `pianoPhysicsMode`, `almightyWaveformMode`, `prebuiltUniverseOnStart`, `cloudsEnabled`, `multiNodeEnabled`, `cleanFlow`, `cinematicMode`, `fovBreathing`, `scaleBandSize`, `motionMode`, `pause`, `fieldLines`, `trailOnly`, `autoOrbitShowcase`, `cymaticStrength`, `shockwaveStrength`, `vortexStrength`, `fieldlineDensity`, `colorGrade`, `contrast`, `saturation`, `maxPixelRatio`, `volumetricBillboards`, `trailSamples`, `updateCap`, `recordFps`.
   - `createRuntimeState()` — frame-to-frame mutables and computed outputs. Examples: `speedMultiplier`, `targetSpeedMultiplier`, `simSpeed`, `targetSimSpeed`, `targetZoomDepth`, `transitionAnchor`, `freeFlight`, `selectedRingIndex`, `selectedTarget`, `jumpTarget`, `jumpProgress`, `jumpActive`, `travelBlend`, `insideBlend`, `travelProgress`, `focusNoteFamily`, `nebulaNodes`, `nebulaBridges`, `noteEvents`, `activeNotes`, `noteFamilyActivation`, `noteFamilyHeld`, `chordType`, `chordNotes`, `ringInstances`, `demoFileName`, `demoTime`, `demoDuration`, `demoPlaying`, `demoBuildProgress`, `originEstablished`, `originNote`, `originFamily`, `originStrength`, `originPhase`, `songUniverseRadius`, `songMemory`, `songObjects`, `songObjectCount`, `songGrowthLevel`, `songDominantStructure`, `songSection`, `songEventRate`, `jamExcitationCount`, `jamGrowthBudget`, `jamParticleReveal`, `totalEnergy`, `chaosLevel`, `goldenEscape`, `torusMajorRadius`, `torusMinorRadius`, `torusStrength`, `gravityStrength`, `cosmicFlower`, `soundRift`, `cloudTint`, `boardRadius`, `boundaryRadius`, `equilibriumRadius`, `innerRepulsionRadius`, `averageParticleRadius`, `radialHistogram`, `recursiveDepth`, `recursiveBlend`, `paletteShift`, `harmonicConvergence`, `harmonicPulse`, `biomeName`, `biomeField`, `biomeFog`, `entityCount`, `eventHorizon`, `encounterName`, `encounterDistance`, `encounterInfluence`, `encounterPeak`, `encounterTrailBoost`, `encounterAim`, `encounterPalette`, `encounterLabelsVisible`, `discoveryIntent`, `universeSeed`, `recycleRadius`, `requestAudio`.

   If a key feels ambiguous between groups (e.g., `preset` could be sim or view), favor `simParams` for anything the user might tweak and `runtimeState` for anything the engine writes during a frame.

2. Rewrite `src/systems/params.js` so `createDefaultParams()` simply composes the groups:

   ```js
   import {
     createViewParams,
     createAudioState,
     createSimParams,
     createRuntimeState,
   } from './paramGroups.js';

   export function createDefaultParams() {
     return {
       ...createViewParams(),
       ...createAudioState(),
       ...createSimParams(),
       ...createRuntimeState(),
     };
   }
   ```

3. Add a header comment at the top of each factory in `paramGroups.js` stating who writes the fields and who reads them. Be brief; one or two lines per group is plenty.

**Do not** change any consumer site. Do not add getters or setters. Do not freeze any object. The flat runtime shape must be preserved exactly.

**Acceptance:**
- `JSON.stringify(Object.keys(createDefaultParams()).sort())` returns the same list of keys before and after.
- `npm run build` passes.
- App runs identically at runtime (manual check: load page, press a piano key, see particles respond).

---

## Task 4 — Extract config tables from CpuParticleSimulator

**Priority:** MEDIUM. Quick win that makes the largest file in the repo readable.

**File:** `src/systems/CpuParticleSimulator.js` (1329 lines).

The top of the file has three lookup tables that are tuning data, not simulation logic:

- `NOTE_FAMILIES` (lines 3–16) — color/sprite/mass/stiffness/damping per chromatic note.
- `INSTRUMENT_FORCES` (lines 18–26) — physics envelope per instrument name.
- `STRUCTURE_TYPES` (lines 28–41) and `STRUCTURE_BAND_RESPONSE` (lines 43–56) — structure list and per-band response weights.

**Steps:**

1. Create:
   - `src/config/noteFamilies.js` — exports `NOTE_FAMILIES`.
   - `src/config/instrumentForces.js` — exports `INSTRUMENT_FORCES`.
   - `src/config/structures.js` — exports both `STRUCTURE_TYPES` and `STRUCTURE_BAND_RESPONSE`.

2. Replace the in-file constants in `CpuParticleSimulator.js` with imports:

   ```js
   import { NOTE_FAMILIES } from '../config/noteFamilies.js';
   import { INSTRUMENT_FORCES } from '../config/instrumentForces.js';
   import { STRUCTURE_TYPES, STRUCTURE_BAND_RESPONSE } from '../config/structures.js';
   ```

3. Keep all constant names identical so the rest of the file is unchanged.

**Why this matters:** these tables are designer-editable. Pulling them out means you can adjust note colors or instrument envelopes without scrolling past 1300 lines of physics integration. It also makes them reusable if any other system needs them later.

**Acceptance:**
- The three (or four) constants no longer appear in `CpuParticleSimulator.js`.
- They are imported from `src/config/`.
- `npm run build` passes.

---

## Task 5 — Code-split the bundle

**Priority:** MEDIUM. Improves first-paint time for the piano default, which is what 90% of visitors will see.

**Files:** `src/main.js`, `src/systems/AttractorUniverse.js`.

**Current state:** Build produces one chunk of ~2.3 MB (~604 KB gzipped). Everything loads eagerly even though only a fraction is needed to play piano.

**Goal:** Lazy-load anything not required for the default piano experience.

**What stays eager:**
- `playcanvas`, `lil-gui`
- `src/main.js`, `src/systems/AttractorUniverse.js`, `src/systems/params.js` (+ Task 3 groups), `src/systems/CpuParticleSimulator.js`
- `src/ui/VirtualPiano.js`, `src/controls/ExplorerCamera.js`
- `src/audio/AudioReactiveSystem.js`
- `src/rendering/TrailSystem.js`, `src/rendering/materials.js`, `src/rendering/mesh.js`
- `src/config/*` (after Task 4)

**What becomes lazy (dynamic `import()`):**
- `src/systems/GpuParticleSimulator.js` — only load when `query.has('gpu') && query.has('webgpu')`.
- `src/rendering/CosmicCloudSystem.js` and `src/rendering/CosmicImpostorSystem.js` — only load when `params.appMode !== 'sound-board'` or `params.cloudsEnabled` is true.
- `src/encounters/EncounterRenderer.js` and `src/encounters/CosmicEncounterSystem.js` — only load when `params.appMode !== 'sound-board'`.
- `src/volumetrics/VolumetricFogSystem.js` — only load when `params.appMode !== 'sound-board'`.
- Demo file loading path in `main.js` (`loadDemoFile`, `loadDemoUrl`) — only import any helpers it depends on when the user actually clicks Upload Song or arrives with `?demo=...`.

**Implementation pattern:**

In `AttractorUniverse.constructor`, replace direct construction with stub references. Add an `async init()` method that conditionally imports and constructs the heavy systems. Call `await universe.init()` once from `main.js` after the universe is created but before `app.start()`. Where a heavy system is referenced in `update()`, guard with `if (this.cosmicClouds) ...`.

**Acceptance:**
- `npm run build` reports multiple chunks; the main entry chunk's gzipped size is under 350 KB.
- Default piano load (`/`) works with no demo/encounter/cloud code in the initial network payload (verify in DevTools Network tab: only the main chunk + playcanvas loaded on first paint).
- `?webgpu=1&gpu=1` still triggers the GPU path (it loads its own chunk).
- Upload Song still works.

---

## Task 6 — Trim the README

**Priority:** LOW. Cosmetic, but the current README is 28 KB and discourages contributions.

**File:** `README.md` (currently ~520 lines).

**Approach:** Reduce to four sections — what it is, how to run, controls cheat sheet, link to a `docs/` folder for the rest. Move the deep narrative on Phase 2/3/4 systems, encounter types, biome list, attractor math, and performance notes into `docs/architecture.md`. Keep the README under 150 lines.

The piano controls table and the URL-state quick reference (`?seed=`, `?preset=`, `?quality=`) are worth keeping at the top because users actually need them.

**Acceptance:**
- `README.md` under 150 lines.
- `docs/architecture.md` exists with the moved content.
- No broken internal links.

---

## Stretch ideas (not requested, do not start without asking)

- Add a single Playwright smoke test that loads the page and verifies the piano element renders and a keydown event triggers `noteEvents` in `params`. One test, ~20 lines, would catch most regressions.
- Add an octave shift (`Z` / `X` keys, clamp 1–7) and surface the current octave in the piano title. Probably useful, but Greg did not ask for it.
- Provide an "audio-off" deterministic mode that drives the same triggers from a seeded RNG, useful for visual regression and for recording demos without microphone setup.

If any of these sound worth doing, raise them with Greg before touching code.

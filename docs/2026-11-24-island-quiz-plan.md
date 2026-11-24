# Island Quiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A static website quiz where players name islands from a flag and a gradually zooming map.

**Architecture:** Plain static files, no build step. Leaflet renders a label-free dark basemap with a label-free satellite layer whose opacity rises as the camera flies in. Pure logic (matching, shuffling) lives in `match.js` so Node can test it.

**Tech Stack:** HTML/CSS/vanilla JS, Leaflet 1.9.4 (cdnjs), CARTO `dark_nolabels` tiles, Esri World Imagery tiles, flagcdn.com flags, Web Audio API, Node (built-in `node:test`) for logic tests.

**Spec:** `docs/2026-11-24-island-quiz-design.md`

## Global Constraints
- Islands: independent island nations + self-governing island territories with own flags. No plain provinces (Sicily, Failaka).
- Map starts fully zoomed out (world view) before each prompt; zooms gradually (~20s).
- No tile layer may show place names.
- Must work at phone width (≥360px) with no horizontal scroll.
- No git repo in folder: commit steps are skipped unless the owner initialises one.

## Review Focus
1. Typing with accents/casing/punctuation ("São Tomé", "st lucia") → accepted as exact.
2. Short names (Fiji, Cuba, Malta) → fuzzy tolerance must not accept a different island ("Cuba" vs "Aruba"); tolerance scales with length.
3. Tiny islands (Nauru, Tuvalu) → visible pulsing marker at world zoom.
4. Restart mid-zoom → old fly animation and timers cancelled, map back to world view.
5. Time Attack best time with localStorage blocked → game still works (try/catch).

---

### Task 1: Matching & shuffle logic

**Files:** Create `island-quiz/match.js`, `island-quiz/tests/match.test.js`

**Interfaces — Produces:**
- `normalize(s: string): string`: lowercase, strip diacritics, `&`→`and`, `st`/`saint` unified to `saint`, drop leading "the ", remove non-alphanumerics.
- `levenshtein(a, b): number`
- `checkGuess(guess: string, island: {name, aliases[]}): 'correct'|'close'|'wrong'`: correct if normalized equal to any name/alias, or distance ≤ `tol(len)` where tol = 0 (len≤4), 1 (≤7), 2 (≤11), else 3; close if distance ≤ tol+2.
- `shuffle(arr): arr` (Fisher–Yates, returns new array)
- UMD style: `window.Match` in browser, `module.exports` in Node.

- [ ] Tests: `checkGuess('sao tome and principe', STP)==='correct'`; `checkGuess('Madagaskar', MDG)==='correct'`; `checkGuess('aruba', CUBA)!=='correct'`; `checkGuess('st lucia', LCA)==='correct'`; `checkGuess('the bahamas', BHS)==='correct'`; `checkGuess('jamica', JAM)==='correct'`; shuffle keeps all elements.
- [ ] Run `node --test island-quiz/tests` → FAIL, then implement, then PASS.

### Task 2: Island data

**Files:** Create `island-quiz/islands.js` → `window.ISLANDS = [{name, aliases[], flag (flagcdn code, e.g. 'jm', 'gb-sct' style), lat, lng, zoom (8–13 final), type:'nation'|'territory', sovereign?, fact}]`.
- [ ] ~45 island nations + ~40 territories. Facts one sentence, accurate.
- [ ] Node check: every entry has all fields, unique names, lat/lng in range, flag codes non-empty.

### Task 3: Page, style, game

**Files:** Create `island-quiz/index.html`, `styles.css`, `game.js`, `audio.js`.

**Interfaces — Consumes:** `Match.*`, `window.ISLANDS`. **Produces:** `Sound.play('correct'|'wrong'|'close'|'skip'|'whoosh'|'win'|'click')`, `Sound.muted`.
- [ ] Start screen: mode choice (Classic / Time Attack), best time shown.
- [ ] Round: `map.setView([20,0], minZoom)` instantly; marker pulse; flag + input in glass dashboard; after 1.2s start staged `flyTo` to island over ~20s (several steps), satellite opacity `= clamp((zoom-3)/5)`.
- [ ] Guess handling via `checkGuess`; reveal card with name, sovereign (if territory) and fact; Next button / Enter.
- [ ] HUD: progress n/total, score, streak, timer (Time Attack). Skip, Shuffle/Restart, Mute.
- [ ] Restart cancels timers/animations (`map.stop()`), reshuffles.
- [ ] Time Attack end: total time, best time in localStorage (try/catch).

### Task 4: Browser verification
- [ ] Serve folder via `.claude/launch.json` static server; play rounds, check console errors, phone width, restart mid-zoom, tiny-island marker, no labels on tiles, flag images load.

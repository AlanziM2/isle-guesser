# Island Quiz — Design (approved 2026-11-24)

## Intent
A browser game: identify islands by flag + map location and type their name. Must look and sound polished.

## Scope
- Islands = independent island nations + self-governing island territories with their own flags (Greenland, Faroes, Puerto Rico, Bermuda, ...). Plain provinces (Sicily, Failaka) excluded.

## Approaches considered
1. Vector-only map (D3) — sleek but zoom shows only an outline.
2. **Chosen:** Leaflet map with label-free dark basemap that crossfades into label-free satellite imagery while gradually flying in to the island. Shows how the place really looks.
3. Framework/build-step app — rejected, no benefit.

## Design
- Static folder: `index.html`, `styles.css`, `game.js`, `islands.js` (name, aliases, lat/lng, zoom, flag ISO code, fact).
- Round: world view + pulsing marker, flag in central glass dashboard; ~20s gradual fly-in, satellite fades in. Fuzzy matching (normalised Levenshtein + aliases), "close" hint, skip. Reveal name + fact.
- Modes: Classic (score/streak), Time Attack (time to name all; best time in localStorage).
- Shuffle/restart, mute. Sounds synthesized with Web Audio.
- Flags from flagcdn.com, tiles from CARTO (dark_nolabels) and Esri World Imagery. Responsive.

## Builder's calls
Exact island list, fact wording, colours, sound timbres, zoom pacing.

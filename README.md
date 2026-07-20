# personal-website
note:
Single-page portfolio for William Moreno — an interactive badge on a lanyard
(three.js, Verlet rope physics) on the left third, and one full-height panel
per role on the right, over a map of each work location's real major features
(rivers, parks, campuses, highways, rail). When the active entry changes the
old map traces itself away, stroke by stroke, while the new one traces up
over it (Canvas 2D — the page runs exactly one WebGL context, the badge's).

## Layout

```
index.html                 ← the single-page app (markup, styles, physics, maps)
content.js                 ← all entry text — EDIT HERE
mapdata.js                 ← major map features per location (see below)
tools/fetch-mapdata.mjs    ← regenerates mapdata.js from OpenStreetMap
assets/vendor/three.min.js ← three.js r128, vendored (no CDN dependency)
assets/                    ← real badge scans / map PNGs (later)
.nojekyll                  ← GitHub Pages serves files untouched
```

## Maps

Each entry's map is drawn from `mapdata.js`: sparse lat/lng polylines for the
area's major features — water first, then parks, university/work campuses,
highways, primary roads, and rail — smoothed into curves and traced in as
animated strokes, with small labels fading in after each stroke lands.

The checked-in data is hand-traced from knowledge of each area's real
geography (base geography © OpenStreetMap contributors, ODbL) because the
environment it was authored in couldn't reach the Overpass API. To swap in
exact OSM geometry, run from any normal machine:

```
node tools/fetch-mapdata.mjs        # rewrites mapdata.js in place
node tools/fetch-mapdata.mjs --dry  # prints instead of writing
```

Adding an entry to `content.js` needs a matching `MAPDATA[id]` block (or the
map will just show the marker and caption); add the location to `LOCATIONS`
in the fetch script and re-run it, or hand-author a few features.

## Editing content

Everything a visitor reads lives in `content.js`, in one ordered `ORGS`
array. Change any field in place; to add an entry, copy one `{ … }` block,
paste it in order, and update the fields — the panel, badge, map, coordinate
label, and navigation dot are all generated from the object.

- `coords` (latitude, longitude) places the site marker; the surrounding
  features come from the matching `mapdata.js` entry.
- `videoId` is the YouTube id; set it to `null` for a placeholder frame.

**Content policy:** public copy stays at resume-level, unclassified detail.
Only "Dragonfly" is named among APL programs; all other programs are neutral
work-thread titles, and specific airframes, radar vendors, boards, and
ground-control tools stay generalized. New APL text is draft until it passes
the same check.

## Running locally

Any static server works:

```
python3 -m http.server 8000
# → http://localhost:8000
```

## Publishing (GitHub Pages)

1. Push to `main`.
2. Repo **Settings → Pages → Source:** Deploy from a branch, branch `main`,
   folder `/ (root)`.
3. The site publishes at `https://<owner>.github.io/personal-website/`.
   Add a `CNAME` file for a custom domain.

No build step, no secrets — YouTube needs no key.

## Accessibility & performance

- `prefers-reduced-motion`: the map trace becomes an instant swap and the
  badge swing damps; the entry animation is skipped.
- Keyboard-reachable navigation dots with visible focus; all text is real,
  selectable HTML.
- Videos load only on click (poster + play button, then the embed); maps are
  cached canvases; device-pixel-ratio is capped.

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
assets/maps/<id>.svg       ← one layered map per location (generated)
tools/fetch-maps.mjs       ← builds those SVGs from OpenStreetMap (Overpass)
mapdata.js                 ← hand-traced fallback data (generator input only)
assets/vendor/three.min.js ← three.js r128, vendored (no CDN dependency)
.nojekyll                  ← GitHub Pages serves files untouched
```

## Maps

Each entry's map is a standalone SVG in `assets/maps/` with one `<g>` layer
per feature class — water areas, waterways, parks, campuses, highways,
roads, rail, labels, marker. The site inlines the active location's SVG and
traces every stroke in with the stroke-dashoffset technique (water → parks →
campuses → highways → roads → rail), fading area fills and labels in behind
their strokes; leaving a section traces the old map back out while the new
one traces up over it. The files preview standalone — open one in a browser
to inspect it.

To (re)generate the SVGs from **real OpenStreetMap geometry**, run from any
machine with open internet access (Node 18+, no dependencies):

```
node tools/fetch-maps.mjs             # fetch + render all locations
node tools/fetch-maps.mjs apl cmu     # just these ids
node tools/fetch-maps.mjs --help      # all options
```

The script has two halves — a **fetch** that hits the Overpass API and a
**render** that draws the SVG — split so you only need the internet for the
first. Every fetch caches its raw OSM response under `assets/maps/.cache/`:

```
node tools/fetch-maps.mjs --fetch-only    # download raw OSM → .cache/, no SVG
node tools/fetch-maps.mjs --from-cache     # rebuild SVGs from .cache/, no network
```

Commit `assets/maps/.cache/*.json` alongside the SVGs and anyone — including
CI or a network-blocked sandbox — can reproduce the exact maps with
`--from-cache` and zero network access. Overpass is rate-limited and
sometimes down, so the cache also means re-rendering never re-downloads.
Several public Overpass mirrors are tried in turn; pin one with the
`OVERPASS_URL` environment variable if a particular mirror serves you best.

> The Claude Code sandbox this repo was built in blocks all OSM/Overpass
> hosts, so the checked-in SVGs are interim ones built with
> `node tools/fetch-maps.mjs --from-mapdata` (hand-traced approximations in
> `mapdata.js`, © OpenStreetMap contributors, ODbL). Running
> `node tools/fetch-maps.mjs` on a normal machine replaces them with true OSM
> geometry — riverbank/reservoir/wetland polygons, real curve detail,
> secondary-road density — with no site changes needed; the SVG contract
> stays the same.

To add a location: add its entry to `LOCATIONS` in `tools/fetch-maps.mjs`
(id must match the `content.js` entry), re-run the script, and the site
picks up `assets/maps/<id>.svg` automatically. Without an SVG the panel
still works — it just shows no map behind the text.

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

# personal-website
note:
Single-page portfolio for William Moreno — an interactive badge on a lanyard
(three.js, Verlet rope physics) on the left third, and one full-height panel
per role on the right, over a procedural map of each work location that
unfolds like a paper road map when the active entry changes (CSS 3D
transforms — the page runs exactly one WebGL context, the badge's).

## Layout

```
index.html                 ← the single-page app (markup, styles, physics, maps)
content.js                 ← all entry text — EDIT HERE
assets/vendor/three.min.js ← three.js r128, vendored (no CDN dependency)
assets/                    ← real badge scans / map PNGs (later)
.nojekyll                  ← GitHub Pages serves files untouched
```

## Editing content

Everything a visitor reads lives in `content.js`, in one ordered `ORGS`
array. Change any field in place; to add an entry, copy one `{ … }` block,
paste it in order, and update the fields — the panel, badge, map, coordinate
label, and navigation dot are all generated from the object.

- `coords` (latitude, longitude) drives the stylized map.
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

- `prefers-reduced-motion`: the paper fold becomes an instant swap and the
  badge swing damps; the entry animation is skipped.
- Keyboard-reachable navigation dots with visible focus; all text is real,
  selectable HTML.
- Videos load only on click (poster + play button, then the embed); maps are
  cached canvases; device-pixel-ratio is capped.

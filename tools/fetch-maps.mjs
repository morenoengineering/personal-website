#!/usr/bin/env node
/* =============================================================
   Generate assets/maps/<id>.svg — one layered map per location.
   =============================================================
   Usage:
     node tools/fetch-maps.mjs                 # real data via Overpass API
     node tools/fetch-maps.mjs apl cmu         # only these locations
     node tools/fetch-maps.mjs --from-mapdata  # offline: rebuild interim SVGs
                                               # from the hand-traced mapdata.js

   No dependencies (Node 18+, built-in fetch). Run the network mode
   from a machine with open internet access — sandboxed environments
   that block overpass-api.de can only use --from-mapdata.
   Set OVERPASS_URL to use a different Overpass mirror.

   Output SVG contract (what index.html relies on):
     - viewBox "0 0 1000 1000" covering `span` km, centered on the
       location; preserveAspectRatio="xMidYMid slice"
     - <g class="layer" data-kind="…"> groups in draw order:
         waterarea waterway park campus highway road rail labels marker
     - stroked features are <path> elements; area features carry
       data-fill="1" (their fill-opacity is animated after tracing);
       the rail dash pattern lives in data-dash (applied after
       tracing, since tracing borrows stroke-dasharray)
     - all styling is in the SVG's own <style>, so files preview
       standalone in a browser

   Data © OpenStreetMap contributors, ODbL (openstreetmap.org/copyright).
   ============================================================= */

import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTDIR = join(ROOT, "assets", "maps");
const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const FROM_MAPDATA = process.argv.includes("--from-mapdata");
const ONLY = process.argv.slice(2).filter(a => !a.startsWith("--"));

const VB = 1000;                       // viewBox size; 1000 units == `span` km

const LOCATIONS = [
  { id: "apl",      place: "Laurel, Maryland",        center: [39.138, -76.878],  span: 15, site: [39.168, -76.897] },
  { id: "intel",    place: "Hillsboro, Oregon",       center: [45.522, -122.955], span: 13, site: [45.523, -122.989] },
  { id: "ge",       place: "Niskayuna, New York",     center: [42.789, -73.862],  span: 13, site: [42.779, -73.849] },
  { id: "cmu",      place: "Pittsburgh, Pennsylvania", center: [40.443, -79.952], span: 12, site: [40.443, -79.943] },
  { id: "richmond", place: "Richmond, Virginia",      center: [37.545, -77.470],  span: 15, site: [37.541, -77.434] }
];

/* ---------------- geometry ---------------- */
const kmLat = 110.574;
const kmLng = lat => 111.32 * Math.cos(lat * Math.PI / 180);

function projector(loc){
  const [clat, clng] = loc.center;
  const u = VB / loc.span;             // viewBox units per km
  const kx = kmLng(clat);
  return (lat, lng) => [
    VB / 2 + (lng - clng) * kx * u,
    VB / 2 - (lat - clat) * kmLat * u
  ];
}

function pathLen(pts){
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
}
function ringArea(pts){
  let s = 0;
  for (let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s / 2);
}
function centroid(pts){
  let x = 0, y = 0;
  for (const p of pts){ x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

/* Douglas-Peucker in viewBox units */
function simplify(pts, tol){
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length){
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const A = pts[a], B = pts[b];
    const bx = B[0] - A[0], by = B[1] - A[1];
    const len2 = bx * bx + by * by || 1e-12;
    let worst = 0, wi = -1;
    for (let i = a + 1; i < b; i++){
      const px = pts[i][0] - A[0], py = pts[i][1] - A[1];
      const t = Math.min(1, Math.max(0, (px * bx + py * by) / len2));
      const d = Math.hypot(px - t * bx, py - t * by);
      if (d > worst){ worst = d; wi = i; }
    }
    if (worst > tol){ keep[wi] = true; stack.push([a, wi], [wi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/* Stitch way fragments end-to-end (snap in viewBox units). */
function stitch(segments, snap){
  const segs = segments.map(s => s.slice());
  const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < snap;
  const chains = [];
  while (segs.length){
    let chain = segs.pop(), grew = true;
    while (grew){
      grew = false;
      for (let i = 0; i < segs.length; i++){
        const s = segs[i], h = chain[0], t = chain[chain.length - 1];
        if (near(t, s[0]))                 chain = chain.concat(s.slice(1));
        else if (near(t, s[s.length - 1])) chain = chain.concat(s.slice(0, -1).reverse());
        else if (near(h, s[s.length - 1])) chain = s.slice(0, -1).concat(chain);
        else if (near(h, s[0]))            chain = s.slice(1).reverse().concat(chain);
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    chains.push(chain);
  }
  return chains.sort((a, b) => pathLen(b) - pathLen(a));
}

/* ---------------- SVG emission ---------------- */
const r1 = v => Math.round(v * 10) / 10;
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

function lineD(pts){
  return pts.map((p, i) => (i ? "L" : "M") + r1(p[0]) + " " + r1(p[1])).join("");
}
/* Catmull-Rom → cubic Béziers, for sparse hand-traced points only */
function smoothD(pts, closed){
  const n = pts.length;
  if (n < 3) return lineD(pts);
  const at = i => pts[closed ? ((i % n) + n) % n : Math.min(Math.max(i, 0), n - 1)];
  let d = "M" + r1(pts[0][0]) + " " + r1(pts[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++){
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    d += "C" + [
      r1(p1[0] + (p2[0] - p0[0]) / 6), r1(p1[1] + (p2[1] - p0[1]) / 6),
      r1(p2[0] - (p3[0] - p1[0]) / 6), r1(p2[1] - (p3[1] - p1[1]) / 6),
      r1(p2[0]), r1(p2[1])
    ].join(" ");
  }
  if (closed) d += "Z";
  return d;
}

const SVG_STYLE = `
  text{font-family:Inter,system-ui,sans-serif;paint-order:stroke;stroke:rgba(255,255,255,.88);stroke-width:3px;letter-spacing:.02em}
  .wa{fill:#E3ECF8;stroke:#C9D8EF;stroke-width:1.4}
  .ww{fill:none;stroke:#BFD2ED;stroke-linecap:round;stroke-linejoin:round}
  .pk{fill:#E5EFE1;stroke:#BFD6B8;stroke-width:1.6}
  .cp{fill:#EEF0FA;stroke:#C3CAE4;stroke-width:1.8}
  .hw{fill:none;stroke:#AEB6C2;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round}
  .rd{fill:none;stroke:#C9CFD8;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  .r2{fill:none;stroke:#DADFE6;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
  .rl{fill:none;stroke:#C6CBD4;stroke-width:1.4}
  .lb{font-size:12px;font-weight:500;fill:#98A0AB}
  .lb-water{fill:#8CA0C6;font-style:italic}
  .lb-park{fill:#85A07E}
  .lb-campus{fill:#767E92;font-weight:600}
`;

/* feature: { kind, cls, name, d, area?, len?, label:[x,y]|null, isArea } */
function emitSvg(loc, features, provenance){
  const ORDER = ["waterarea", "waterway", "park", "campus", "highway", "road", "rail"];
  const byKind = Object.fromEntries(ORDER.map(k => [k, []]));
  for (const f of features) if (byKind[f.kind]) byKind[f.kind].push(f);

  /* labels: priority campuses > water > parks > highways; crude collision grid */
  const used = [];
  const labels = [];
  const free = (x, y) => !used.some(u => Math.abs(u[0] - x) < 150 && Math.abs(u[1] - y) < 34);
  const want = [
    ...byKind.campus.map(f => [f, "lb lb-campus"]),
    ...byKind.waterarea.filter(f => f.name).map(f => [f, "lb lb-water"]),
    ...byKind.waterway.filter(f => f.name).map(f => [f, "lb lb-water"]),
    ...byKind.park.filter(f => f.name).map(f => [f, "lb lb-park"]),
    ...byKind.highway.filter(f => f.name).map(f => [f, "lb"]),
    ...byKind.road.filter(f => f.name && f.cls === "rd").map(f => [f, "lb"]),
    ...byKind.rail.filter(f => f.name).map(f => [f, "lb"])
  ];
  const seen = new Set();
  for (const [f, cls] of want){
    if (!f.name || !f.label || seen.has(f.name)) continue;
    const [x, y] = f.label;
    if (x < 40 || x > VB - 40 || y < 30 || y > VB - 24 || !free(x, y)) continue;
    seen.add(f.name); used.push([x, y]);
    labels.push(`    <text x="${r1(x)}" y="${r1(y)}" text-anchor="middle" class="${cls}">${esc(f.name)}</text>`);
  }

  const proj = projector(loc);
  const [sx, sy] = proj(loc.site[0], loc.site[1]);
  const lines = [];
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB} ${VB}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Map of ${esc(loc.place)}">`);
  lines.push(`  <!-- ${provenance} — data © OpenStreetMap contributors, ODbL -->`);
  lines.push(`  <style>${SVG_STYLE}  </style>`);
  for (const kind of ORDER){
    const fs = byKind[kind];
    lines.push(`  <g class="layer" data-kind="${kind}">`);
    for (const f of fs){
      const attrs = [`class="${f.cls}"`, `d="${f.d}"`];
      if (f.isArea) attrs.push(`data-fill="1"`);
      if (kind === "rail") attrs.push(`data-dash="7 6"`);
      if (f.w) attrs.push(`style="stroke-width:${f.w}"`);
      lines.push(`    <path ${attrs.join(" ")}/>`);
    }
    lines.push(`  </g>`);
  }
  lines.push(`  <g class="layer" data-kind="labels">`);
  lines.push(labels.join("\n"));
  lines.push(`  </g>`);
  lines.push(`  <g class="layer" data-kind="marker">`);
  lines.push(`    <circle cx="${r1(sx)}" cy="${r1(sy)}" r="11" fill="none" stroke="rgba(52,87,213,.35)" stroke-width="1.5"/>`);
  lines.push(`    <circle cx="${r1(sx)}" cy="${r1(sy)}" r="4.5" fill="#3457D5"/>`);
  lines.push(`  </g>`);
  lines.push(`</svg>`);
  return lines.join("\n") + "\n";
}

/* ---------------- mode 1: offline, from mapdata.js ---------------- */
function fromMapdata(loc){
  const src = readFileSync(join(ROOT, "mapdata.js"), "utf8");
  const MAPDATA = new Function(src + "; return MAPDATA;")();
  const data = MAPDATA[loc.id];
  if (!data) return [];
  const proj = projector({ ...loc, center: data.center || loc.center, span: data.span || loc.span });
  const out = [];
  for (const f of data.features){
    const pts = f.pts.map(p => proj(p[0], p[1]));
    const closed = f.kind === "park" || f.kind === "campus";
    const kind = f.kind === "water" ? "waterway" : f.kind;
    const cls = { waterway: "ww", park: "pk", campus: "cp", highway: "hw", road: "rd", rail: "rl" }[kind];
    const label = closed ? centroid(pts)
      : (() => { const i = Math.round((f.labelAt || 0.52) * (pts.length - 1)); return [pts[i][0], pts[i][1] - 9]; })();
    out.push({
      kind, cls, name: f.name || null, isArea: closed,
      d: smoothD(pts, closed),
      w: kind === "waterway" ? (f.w || 6) : undefined,
      label
    });
  }
  return out;
}

/* ---------------- mode 2: live, from Overpass ---------------- */
function bboxOf(loc){
  const [lat, lng] = loc.center;
  const dLat = loc.span / 2 / kmLat * 1.30;
  const dLng = loc.span / 2 / kmLng(lat) * 1.55;
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map(v => v.toFixed(4)).join(",");
}

const QUERY = b => `[out:json][timeout:120];
(
  way[natural=water](${b});
  relation[natural=water](${b});
  way[waterway~"^(river|canal|stream)$"](${b});
  way[leisure~"^(park|nature_reserve|golf_course)$"](${b});
  relation[leisure~"^(park|nature_reserve)$"](${b});
  way[amenity~"^(university|college|research_institute)$"][name](${b});
  relation[amenity~"^(university|college|research_institute)$"][name](${b});
  way[aeroway=aerodrome][name](${b});
  way[landuse=industrial][name](${b});
  way[highway~"^(motorway|trunk|primary|secondary)$"](${b});
  way[railway~"^(rail|light_rail)$"][service!~"."](${b});
);
out tags geom;`;

async function overpass(query){
  if (process.env.OVERPASS_FIXTURE)    // offline test hook: canned response file
    return JSON.parse(readFileSync(process.env.OVERPASS_FIXTURE, "utf8")).elements || [];
  for (let attempt = 0; ; attempt++){
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query)
    });
    if (res.ok) return (await res.json()).elements || [];
    if ((res.status === 429 || res.status === 504) && attempt < 3){
      const wait = 15000 * (attempt + 1);
      process.stderr.write(`  overpass ${res.status}, retrying in ${wait / 1000}s…\n`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/* relation → outer rings (member line fragments stitched closed) */
function relationRings(el, proj){
  const segs = (el.members || [])
    .filter(m => m.type === "way" && (m.role === "outer" || !m.role) && m.geometry)
    .map(m => m.geometry.map(g => proj(g.lat, g.lon)));
  if (!segs.length) return [];
  return stitch(segs, 3).filter(r =>
    r.length > 3 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) < 6);
}

function classify(tags){
  if (tags.natural === "water" || tags.waterway === "riverbank") return "waterarea";
  if (tags.waterway) return "waterway";
  if (tags.leisure) return "park";
  if (tags.amenity || tags.aeroway || tags.landuse) return "campus";
  if (tags.railway) return "rail";
  if (tags.highway === "motorway" || tags.highway === "trunk") return "highway";
  if (tags.highway) return "road";
  return null;
}

async function fromOverpass(loc){
  const kmU = VB / loc.span;                          // units per km
  const proj = projector(loc);
  const elements = await overpass(QUERY(bboxOf(loc)));
  process.stderr.write(`  ${elements.length} raw elements\n`);

  const areas = [];        // {kind, name, ring}
  const lineGroups = new Map();  // key kind|class|name -> {kind, cls, name, segs:[]}
  const TOL_LINE = 1.6, TOL_AREA = 1.2;               // ≈ 24 m / 18 m at span 15

  for (const el of elements){
    const t = el.tags || {};
    const kind = classify(t);
    if (!kind) continue;

    if (kind === "waterarea" || kind === "park" || kind === "campus"){
      let rings = [];
      if (el.type === "relation") rings = relationRings(el, proj);
      else if (el.geometry){
        const r = el.geometry.map(g => proj(g.lat, g.lon));
        if (r.length > 3) rings = [r];
      }
      for (const ring of rings)
        areas.push({ kind, name: t.name || null, ring, tags: t });
      continue;
    }

    if (!el.geometry) continue;
    const pts = el.geometry.map(g => proj(g.lat, g.lon));
    if (pts.length < 2) continue;
    let cls =
      kind === "waterway" ? "ww" :
      kind === "highway"  ? "hw" :
      kind === "rail"     ? "rl" :
      t.highway === "secondary" ? "r2" : "rd";
    /* skip minor unnamed streams; keep named or long ones */
    if (t.waterway === "stream" && !t.name && pathLen(pts) < 2 * kmU) continue;
    const name = t.name || t.ref || null;
    const key = kind + "|" + cls + "|" + (name || "#" + el.id);
    if (!lineGroups.has(key)) lineGroups.set(key, { kind, cls, name, tags: t, segs: [] });
    lineGroups.get(key).segs.push(pts);
  }

  const features = [];

  /* areas — dedupe tiny slivers, keep the meaningful ones */
  const MIN = { waterarea: 0.02, park: 0.06, campus: 0.18 };  // km²
  const kept = { park: 0, campus: 0, waterarea: 0 };
  const CAP = { waterarea: 40, park: 14, campus: 4 };
  areas.sort((a, b) => ringArea(b.ring) - ringArea(a.ring));
  const namedSeen = new Set();
  for (const a of areas){
    const km2 = ringArea(a.ring) / (kmU * kmU);
    if (km2 < MIN[a.kind] || kept[a.kind] >= CAP[a.kind]) continue;
    if (a.name && namedSeen.has(a.kind + a.name)) continue;   // way+relation dupes
    if (a.name) namedSeen.add(a.kind + a.name);
    /* unnamed parks stay anonymous shapes; unnamed campuses are noise */
    if (a.kind === "campus" && !a.name) continue;
    const ring = simplify(a.ring, TOL_AREA);
    if (ring.length < 4) continue;
    kept[a.kind]++;
    features.push({
      kind: a.kind, name: a.name, isArea: true,
      cls: { waterarea: "wa", park: "pk", campus: "cp" }[a.kind],
      d: lineD(ring) + "Z",
      label: centroid(ring)
    });
  }

  /* lines — stitch same-named fragments, drop stubs, cap counts */
  const capPer = { waterway: 12, highway: 40, road: 160, rail: 12 };
  const counts = {};
  const groups = [...lineGroups.values()]
    .map(g => ({ ...g, chains: stitch(g.segs, 2) }))
    .sort((a, b) => pathLen(b.chains[0] || []) - pathLen(a.chains[0] || []));
  for (const g of groups){
    if ((counts[g.kind] = (counts[g.kind] || 0) + 1) > (capPer[g.kind] || 99)) continue;
    const minLen = g.kind === "road" ? 0.5 * kmU : 0.8 * kmU;
    const chains = g.chains.filter(c => pathLen(c) > minLen).slice(0, 6)
      .map(c => simplify(c, TOL_LINE)).filter(c => c.length > 1);
    if (!chains.length) continue;
    const main = chains[0];
    let mid = main[Math.floor(main.length / 2)];
    features.push({
      kind: g.kind, cls: g.cls, name: g.name, isArea: false,
      d: chains.map(lineD).join(""),
      w: g.kind === "waterway" ? (g.tags.waterway === "river" ? 4 : 2.2) : undefined,
      label: [mid[0], mid[1] - 9]
    });
  }
  return features;
}

/* ---------------- main ---------------- */
mkdirSync(OUTDIR, { recursive: true });
const todo = LOCATIONS.filter(l => !ONLY.length || ONLY.includes(l.id));
if (!todo.length){
  console.error("No matching locations. Ids: " + LOCATIONS.map(l => l.id).join(", "));
  process.exit(1);
}
for (const loc of todo){
  process.stderr.write(`${loc.place} …\n`);
  const features = FROM_MAPDATA ? fromMapdata(loc) : await fromOverpass(loc);
  const provenance = FROM_MAPDATA
    ? "INTERIM: generated from hand-traced mapdata.js; replace by running tools/fetch-maps.mjs with network access"
    : "Generated from the Overpass API on " + new Date().toISOString().slice(0, 10);
  const svg = emitSvg(loc, features, provenance);
  const file = join(OUTDIR, loc.id + ".svg");
  writeFileSync(file, svg);
  process.stderr.write(`  wrote ${file} (${(svg.length / 1024).toFixed(1)} kB, ${features.length} features)\n`);
  if (!FROM_MAPDATA) await new Promise(r => setTimeout(r, 3000));   // be polite to Overpass
}

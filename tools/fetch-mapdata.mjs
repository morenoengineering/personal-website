#!/usr/bin/env node
/* =============================================================
   Regenerate ../mapdata.js from the Overpass API (OpenStreetMap).
   =============================================================
   Usage:   node tools/fetch-mapdata.mjs          # writes mapdata.js
            node tools/fetch-mapdata.mjs --dry    # prints instead

   Needs no dependencies (Node 18+, built-in fetch). Run it from a
   machine with open network access — the Claude Code sandbox this
   repo was edited in blocks overpass-api.de, which is why the
   checked-in mapdata.js is hand-traced. This script replaces it
   with true OSM geometry in the same schema the site renders.

   Per location it pulls, within a bbox derived from center+span:
     water    waterway=river|canal (major named runs)
     park     leisure=park|nature_reserve|garden ways (largest few)
     campus   amenity=university|college ways, plus named aeroways
     highway  highway=motorway|trunk
     road     highway=primary (+secondary if primary is sparse)
     rail     railway=rail main lines, light_rail
   then stitches same-named ways, simplifies (Douglas-Peucker),
   keeps the longest few per kind, and writes MAPDATA.

   Data © OpenStreetMap contributors, ODbL — keep the attribution
   note that the site footer already carries.
   ============================================================= */

import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OVERPASS = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "mapdata.js");
const DRY = process.argv.includes("--dry");

/* Same centers/spans the site uses — tune here, then re-run. */
const LOCATIONS = [
  { id: "apl",      name: "Laurel, Maryland",      center: [39.138, -76.878], span: 15, site: [39.168, -76.897] },
  { id: "intel",    name: "Hillsboro, Oregon",     center: [45.522, -122.955], span: 13, site: [45.523, -122.989] },
  { id: "ge",       name: "Niskayuna, New York",   center: [42.789, -73.862], span: 13, site: [42.779, -73.849] },
  { id: "cmu",      name: "Pittsburgh, Pennsylvania", center: [40.443, -79.952], span: 12, site: [40.443, -79.943] },
  { id: "richmond", name: "Richmond, Virginia",    center: [37.545, -77.470], span: 15, site: [37.541, -77.434] }
];

/* per-kind extraction: overpass selector, max features, stroke width */
const KINDS = [
  { kind: "water",   max: 3, w: n => (n || "").match(/canal|creek|branch/i) ? 5 : 10,
    q: b => `way[waterway~"^(river|canal)$"](${b});` },
  { kind: "park",    max: 4, ring: true,
    q: b => `way[leisure~"^(park|nature_reserve|garden)$"][name](${b});` },
  { kind: "campus",  max: 3, ring: true,
    q: b => `way[amenity~"^(university|college)$"][name](${b});way[aeroway=aerodrome][name](${b});` },
  { kind: "highway", max: 5, w: () => 4,
    q: b => `way[highway~"^(motorway|trunk)$"](${b});` },
  { kind: "road",    max: 6, w: () => 2.5,
    q: b => `way[highway=primary](${b});` },
  { kind: "rail",    max: 3, w: () => 1.5,
    q: b => `way[railway~"^(rail|light_rail)$"][usage!=industrial][service!~"."](${b});` }
];

function bboxOf(loc){
  const [lat, lng] = loc.center;
  const dLat = loc.span / 2 / 110.574 * 1.35;          // a little margin past the view
  const dLng = loc.span / 2 / (111.32 * Math.cos(lat * Math.PI / 180)) * 1.6;
  return [lat - dLat, lng - dLng, lat + dLat, lng + dLng].map(v => v.toFixed(4)).join(",");
}

async function overpass(query){
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(`[out:json][timeout:60];(${query});out tags geom;`)
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()).elements || [];
}

/* ---------- geometry helpers (lat/lng, km-aware) ---------- */
const kmLat = 110.574;
const kmLng = lat => 111.32 * Math.cos(lat * Math.PI / 180);
function segKm(a, b){
  return Math.hypot((a[0] - b[0]) * kmLat, (a[1] - b[1]) * kmLng(a[0]));
}
function lineKm(pts){
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += segKm(pts[i - 1], pts[i]);
  return s;
}

/* Douglas-Peucker, tolerance in km */
function simplify(pts, tolKm){
  if (pts.length < 3) return pts;
  const keep = new Array(pts.length).fill(false);
  keep[0] = keep[pts.length - 1] = true;
  const stack = [[0, pts.length - 1]];
  while (stack.length){
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const A = pts[a], B = pts[b];
    const ax = 0, ay = 0;
    const bx = (B[1] - A[1]) * kmLng(A[0]), by = (B[0] - A[0]) * kmLat;
    const len2 = bx * bx + by * by || 1e-12;
    let worst = 0, wi = -1;
    for (let i = a + 1; i < b; i++){
      const px = (pts[i][1] - A[1]) * kmLng(A[0]), py = (pts[i][0] - A[0]) * kmLat;
      const t = Math.min(1, Math.max(0, (px * bx + py * by) / len2));
      const d = Math.hypot(px - t * bx, py - t * by);
      if (d > worst){ worst = d; wi = i; }
    }
    if (worst > tolKm){ keep[wi] = true; stack.push([a, wi], [wi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/* Stitch same-named way segments end-to-end (greedy, 150 m snap). */
function stitch(segments){
  const SNAP = 0.15;
  const segs = segments.map(s => s.slice());
  const chains = [];
  while (segs.length){
    let chain = segs.pop();
    let grew = true;
    while (grew){
      grew = false;
      for (let i = 0; i < segs.length; i++){
        const s = segs[i];
        const h = chain[0], t = chain[chain.length - 1];
        if (segKm(t, s[0]) < SNAP)      { chain = chain.concat(s.slice(1)); }
        else if (segKm(t, s[s.length-1]) < SNAP) { chain = chain.concat(s.slice(0, -1).reverse()); }
        else if (segKm(h, s[s.length-1]) < SNAP) { chain = s.slice(0, -1).concat(chain); }
        else if (segKm(h, s[0]) < SNAP) { chain = s.slice(1).reverse().concat(chain); }
        else continue;
        segs.splice(i, 1); grew = true; break;
      }
    }
    chains.push(chain);
  }
  return chains.sort((a, b) => lineKm(b) - lineKm(a));
}

function ringAreaKm2(pts){
  let s = 0;
  const kx = kmLng(pts[0][0]);
  for (let i = 0; i < pts.length; i++){
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += (a[1] * kx) * (b[0] * kmLat) - (b[1] * kx) * (a[0] * kmLat);
  }
  return Math.abs(s / 2);
}

const r3 = v => Math.round(v * 1000) / 1000;

async function buildLocation(loc){
  const b = bboxOf(loc);
  const features = [];
  for (const K of KINDS){
    const elements = await overpass(K.q(b));
    await new Promise(r => setTimeout(r, 1500));       // be polite to Overpass
    const named = new Map();
    for (const el of elements){
      if (!el.geometry) continue;
      const name = el.tags?.name || el.tags?.ref || "";
      const key = K.ring ? name + "#" + el.id : name;  // rings stay per-way
      if (!named.has(key)) named.set(key, { name, segs: [] });
      named.get(key).segs.push(el.geometry.map(g => [g.lat, g.lon]));
    }

    let picked = [];
    for (const { name, segs } of named.values()){
      if (K.ring){
        const ring = segs[0];
        if (ring.length < 4 || segKm(ring[0], ring[ring.length - 1]) > 0.2) continue;
        picked.push({ name, pts: ring.slice(0, -1), area: ringAreaKm2(ring) });
      } else {
        const chain = stitch(segs)[0];                 // longest run under this name
        if (chain && lineKm(chain) > loc.span * 0.15)  // skip stubs
          picked.push({ name, pts: chain, km: lineKm(chain) });
      }
    }
    picked.sort((a, b) => K.ring ? b.area - a.area : b.km - a.km);
    for (const f of picked.slice(0, K.max)){
      const tol = K.ring ? 0.05 : 0.08;
      const pts = simplify(f.pts, tol).map(p => [r3(p[0]), r3(p[1])]);
      if (pts.length < (K.ring ? 4 : 3)) continue;
      const feat = { kind: K.kind, name: f.name || undefined, pts };
      if (K.w) feat.w = K.w(f.name);
      features.push(feat);
    }
    process.stderr.write(`  ${loc.id}/${K.kind}: ${Math.min(picked.length, K.max)} feature(s)\n`);
  }
  return features;
}

function serialize(all){
  const lines = [];
  lines.push("/* =============================================================");
  lines.push("   MAP DATA — major features around each résumé location.");
  lines.push("   Generated by tools/fetch-mapdata.mjs from the Overpass API on");
  lines.push("   " + new Date().toISOString().slice(0, 10) + ".");
  lines.push("   Data © OpenStreetMap contributors, ODbL (openstreetmap.org/copyright).");
  lines.push("   Schema: see tools/fetch-mapdata.mjs. Re-run the script to refresh.");
  lines.push("   ============================================================= */");
  lines.push("");
  lines.push("const MAPDATA = {");
  all.forEach(({ loc, features }, li) => {
    lines.push(`  /* ---- ${loc.name} ---- */`);
    lines.push(`  ${loc.id}: {`);
    lines.push(`    center: [${loc.center[0]}, ${loc.center[1]}],`);
    lines.push(`    span: ${loc.span},`);
    lines.push(`    features: [`);
    features.forEach((f, fi) => {
      const head = `      { kind: ${JSON.stringify(f.kind)}` +
        (f.name ? `, name: ${JSON.stringify(f.name)}` : "") +
        (f.w ? `, w: ${f.w}` : "") + ", pts: [";
      const pts = f.pts.map(p => `[${p[0]}, ${p[1]}]`).join(", ");
      lines.push(head + pts + "]}" + (fi < features.length - 1 ? "," : ""));
    });
    lines.push(`    ]`);
    lines.push(`  }` + (li < all.length - 1 ? "," : ""));
  });
  lines.push("};");
  lines.push("");
  return lines.join("\n");
}

const all = [];
for (const loc of LOCATIONS){
  process.stderr.write(`${loc.name} …\n`);
  all.push({ loc, features: await buildLocation(loc) });
}
const js = serialize(all);
if (DRY) console.log(js);
else {
  writeFileSync(OUT, js);
  process.stderr.write(`wrote ${OUT} (${js.length} bytes)\n`);
}

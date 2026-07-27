#!/usr/bin/env node
// Classify where elements sit relative to their owning frame, how they relate to each other, and
// emit the exact AnchorPoint / Position / Size to reproduce them.
// Part of the roblox-element-placement skill.
//
// Two things this exists to make non-negotiable:
//   1. "Is it inside?" is a signed-delta question, not an eyeball question. A negative delta means
//      the element hangs OUTSIDE that edge — normal and idiomatic in Roblox, and the case that
//      web-trained instincts silently get wrong.
//   2. Elements are not independent. A run of adjacent, centre-aligned, evenly-spaced siblings is a
//      layout, not N hand-placed positions. Relations are how you discover that from a flat image.

const HELP = `
place.mjs — classify element placement relative to a frame, and relations between elements

  node place.mjs --frame <x0,y0,x1,y1> --element <name:x0,y0,x1,y1> [--element ...] [options]

Options
  --frame <box>         Frame bounding box in reference pixels. Required.
  --element <spec>      Repeatable. Either "name:x0,y0,x1,y1" or bare "x0,y0,x1,y1".
  --name <str>          Name for a bare --element. Default: Element
  --class <str>         Roblox class for the emitted snippet. Default: Frame
  --tolerance <px>      Overhang/alignment smaller than this counts as flush. Default: 3
  --json                Emit JSON instead of the report.
  -h, --help            This text.

Boxes are x0,y0,x1,y1 with y growing downward, matching image coordinates.

With two or more elements it also reports pairwise relations, group candidates, and the
UIListLayout those groups imply.
`.trim();

function parseArgs(argv) {
  const out = { name: "Element", className: "Frame", tolerance: 3, json: false, help: false, elements: [] };
  const single = { "--frame": "frame", "--name": "name", "--class": "className", "--tolerance": "tolerance" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--json") out.json = true;
    else if (a === "--element") {
      const v = argv[i + 1];
      if (v === undefined) throw new Error("--element requires a value.");
      out.elements.push(v);
      i += 1;
    } else if (single[a]) {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`${a} requires a value.`);
      out[single[a]] = v;
      i += 1;
    } else throw new Error(`Unknown argument: ${a}`);
  }
  out.tolerance = Number(out.tolerance);
  return out;
}

function parseBox(s, label) {
  const parts = String(s).split(",").map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some(Number.isNaN)) {
    throw new Error(`--${label} must be x0,y0,x1,y1 — got "${s}"`);
  }
  const [x0, y0, x1, y1] = parts;
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

// "Name:x0,y0,x1,y1" or bare "x0,y0,x1,y1"
function parseElementSpec(spec, fallbackName) {
  const idx = spec.indexOf(":");
  if (idx === -1) return { name: fallbackName, box: parseBox(spec, "element") };
  return { name: spec.slice(0, idx).trim() || fallbackName, box: parseBox(spec.slice(idx + 1), "element") };
}

const round = (n) => Math.round(n);
const cx = (b) => (b.x0 + b.x1) / 2;
const cy = (b) => (b.y0 + b.y1) / 2;
const wOf = (b) => b.x1 - b.x0;
const hOf = (b) => b.y1 - b.y0;

// ---------------------------------------------------------------- placement

export function classify(frame, el, tolerance = 3) {
  const fw = wOf(frame), fh = hOf(frame);
  const w = wOf(el), h = hOf(el);

  // Positive = inside that edge, negative = hanging outside it.
  const d = {
    left: el.x0 - frame.x0,
    top: el.y0 - frame.y0,
    right: frame.x1 - el.x1,
    bottom: frame.y1 - el.y1,
  };

  const rcx = cx(el) - frame.x0;
  const rcy = cy(el) - frame.y0;

  const outside = Object.entries(d).filter(([, v]) => v < -tolerance).map(([k]) => k);
  const centreInside = rcx >= 0 && rcx <= fw && rcy >= 0 && rcy <= fh;

  const near = 0.25;
  const axis = (c, extent) => {
    if (Math.abs(c - extent / 2) <= extent * 0.04) return { scale: 0.5, offset: round(c - extent / 2) };
    if (c <= extent * near) return { scale: 0, offset: round(c) };
    if (extent - c <= extent * near) return { scale: 1, offset: round(c - extent) };
    return { scale: Number((c / extent).toFixed(3)), offset: 0 };
  };
  const ax = axis(rcx, fw);
  const ay = axis(rcy, fh);

  let cls, detail;
  const fills = w >= fw * 0.9 && h >= fh * 0.9;
  const centred = Math.abs(rcx - fw / 2) <= fw * 0.04 && Math.abs(rcy - fh / 2) <= fh * 0.04;

  if (outside.length && centreInside) {
    cls = "STRADDLE";
    detail = outside.map((e) => `${Math.abs(round(d[e]))}px past the ${e} edge`).join(", ");
  } else if (outside.length && !centreInside) {
    cls = "OUTSIDE";
    detail = `centre lies beyond the frame; ${outside.map((e) => `${Math.abs(round(d[e]))}px past ${e}`).join(", ")}`;
  } else if (fills) {
    cls = "FILL";
    detail = `gutters L${round(d.left)} T${round(d.top)} R${round(d.right)} B${round(d.bottom)}`;
  } else if (centred) {
    cls = "CENTRED";
    detail = "centre matches the frame centre";
  } else {
    cls = "INSET";
    const nearest = Object.entries(d).sort((a, b) => a[1] - b[1])[0];
    detail = `fully inside; nearest edge is ${nearest[0]} at ${round(nearest[1])}px`;
  }

  const fmt = (u) => `${u.scale}, ${u.offset}`;
  return {
    class: cls,
    detail,
    outsideEdges: outside,
    size: { w: round(w), h: round(h) },
    frame: { w: round(fw), h: round(fh) },
    deltas: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, round(v)])),
    centre: { x: round(rcx), y: round(rcy), fx: Number((rcx / fw).toFixed(3)), fy: Number((rcy / fh).toFixed(3)) },
    anchorPoint: [0.5, 0.5],
    positionLua: `UDim2.new(${fmt(ax)}, ${fmt(ay)})`,
    sizeLua: `UDim2.fromOffset(${round(w)}, ${round(h)})`,
  };
}

// ---------------------------------------------------------------- relations

// Adjacent if the gap is small relative to the smaller element, and the perpendicular spans overlap
// enough that they read as sitting on the same line.
function overlapFraction(a0, a1, b0, b1) {
  const o = Math.min(a1, b1) - Math.max(a0, b0);
  return o / Math.max(1, Math.min(a1 - a0, b1 - b0));
}

export function relate(a, b, tolerance = 3) {
  const rels = [];
  const gapX = b.box.x0 - a.box.x1;
  const gapY = b.box.y0 - a.box.y1;
  const vOverlap = overlapFraction(a.box.y0, a.box.y1, b.box.y0, b.box.y1);
  const hOverlap = overlapFraction(a.box.x0, a.box.x1, b.box.x0, b.box.x1);

  const adjX = Math.max(24, 0.5 * Math.min(wOf(a.box), wOf(b.box)));
  const adjY = Math.max(24, 0.5 * Math.min(hOf(a.box), hOf(b.box)));

  // Adjacent pairs are the useful signal; moderately-separated pairs in the same band are still
  // worth reporting as ordering context. Anything further apart is noise.
  if (gapX >= -tolerance && vOverlap > 0.5 && gapX <= adjX * 3) {
    rels.push({
      kind: gapX <= adjX ? "immediately-right-of" : "right-of",
      of: a.name, subject: b.name, gap: round(gapX), symmetric: false,
    });
  }
  if (gapY >= -tolerance && hOverlap > 0.5 && gapY <= adjY * 3) {
    rels.push({
      kind: gapY <= adjY ? "immediately-below" : "below",
      of: a.name, subject: b.name, gap: round(gapY), symmetric: false,
    });
  }
  if (Math.abs(cy(a.box) - cy(b.box)) <= Math.max(tolerance, 6) && vOverlap > 0.3) {
    rels.push({ kind: "centre-aligned-y", symmetric: true, of: a.name, subject: b.name, delta: round(Math.abs(cy(a.box) - cy(b.box))) });
  }
  if (Math.abs(cx(a.box) - cx(b.box)) <= Math.max(tolerance, 6) && hOverlap > 0.3) {
    rels.push({ kind: "centre-aligned-x", symmetric: true, of: a.name, subject: b.name, delta: round(Math.abs(cx(a.box) - cx(b.box))) });
  }
  if (Math.abs(wOf(a.box) - wOf(b.box)) <= tolerance && Math.abs(hOf(a.box) - hOf(b.box)) <= tolerance) {
    rels.push({ kind: "same-size-as", symmetric: true, of: a.name, subject: b.name });
  }
  if (b.box.x0 >= a.box.x0 && b.box.x1 <= a.box.x1 && b.box.y0 >= a.box.y0 && b.box.y1 <= a.box.y1) {
    rels.push({ kind: "contained-by", of: a.name, subject: b.name });
  }
  return rels;
}

// A run: elements chained by immediate adjacency on one axis AND aligned on the other.
export function findRuns(elements, tolerance = 3) {
  const runs = [];
  for (const [axis, sortKey, alignFn, gapFn] of [
    ["Horizontal", (e) => e.box.x0, (a, b) => Math.abs(cy(a.box) - cy(b.box)), (a, b) => b.box.x0 - a.box.x1],
    ["Vertical", (e) => e.box.y0, (a, b) => Math.abs(cx(a.box) - cx(b.box)), (a, b) => b.box.y0 - a.box.y1],
  ]) {
    const sorted = [...elements].sort((p, q) => sortKey(p) - sortKey(q));
    let cur = [sorted[0]];
    const gaps = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1], el = sorted[i];
      const gap = gapFn(prev, el);
      const aligned = alignFn(prev, el) <= Math.max(tolerance, 6);
      const limit = axis === "Horizontal"
        ? Math.max(24, 0.5 * Math.min(wOf(prev.box), wOf(el.box)))
        : Math.max(24, 0.5 * Math.min(hOf(prev.box), hOf(el.box)));
      if (aligned && gap >= -tolerance && gap <= limit) {
        cur.push(el); gaps.push(gap);
      } else {
        if (cur.length >= 2) runs.push({ axis, members: cur, gaps: [...gaps] });
        cur = [el]; gaps.length = 0;
      }
    }
    if (cur.length >= 2) runs.push({ axis, members: cur, gaps: [...gaps] });
  }
  return runs;
}

function runBox(members) {
  return {
    x0: Math.min(...members.map((m) => m.box.x0)),
    y0: Math.min(...members.map((m) => m.box.y0)),
    x1: Math.max(...members.map((m) => m.box.x1)),
    y1: Math.max(...members.map((m) => m.box.y1)),
  };
}

// ---------------------------------------------------------------- report

function elementBlock(name, className, r) {
  const sgn = (v) => `${v >= 0 ? "+" : ""}${v}`;
  const L = [];
  L.push(`${name} (${className})  ${r.size.w} x ${r.size.h}`);
  L.push(`  edge deltas (positive = inside):  left ${sgn(r.deltas.left)}  top ${sgn(r.deltas.top)}  right ${sgn(r.deltas.right)}  bottom ${sgn(r.deltas.bottom)}`);
  L.push(`  centre relative to frame: (${r.centre.x}, ${r.centre.y})  =  (${r.centre.fx}, ${r.centre.fy}) of frame`);
  L.push("");
  L.push(`  CLASS: ${r.class} — ${r.detail}`);
  if (r.class === "STRADDLE") {
    L.push("  NOTE: part of this element sits OUTSIDE the frame. That is intentional and idiomatic.");
    L.push("        Do not tuck it inside. Ensure the frame does not set ClipsDescendants = true.");
  }
  L.push("");
  L.push(`  Size        = ${r.sizeLua}`);
  L.push(`  AnchorPoint = Vector2.new(${r.anchorPoint[0]}, ${r.anchorPoint[1]})`);
  L.push(`  Position    = ${r.positionLua}`);
  return L.join("\n");
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message, "\n\n" + HELP);
    process.exit(2);
  }
  if (args.help) { console.log(HELP); process.exit(0); }
  if (!args.frame || args.elements.length === 0) {
    console.error("--frame and at least one --element are required.\n\n" + HELP);
    process.exit(2);
  }

  let frame, elements;
  try {
    frame = parseBox(args.frame, "frame");
    elements = args.elements.map((s) => parseElementSpec(s, args.name));
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const placed = elements.map((e) => ({ ...e, placement: classify(frame, e.box, args.tolerance) }));

  if (args.json) {
    const rels = [];
    for (let i = 0; i < placed.length; i += 1)
      for (let j = 0; j < placed.length; j += 1)
        if (i !== j) rels.push(...relate(placed[i], placed[j], args.tolerance));
    const runs = findRuns(placed, args.tolerance).map((r) => ({
      axis: r.axis, members: r.members.map((m) => m.name), gaps: r.gaps.map(round), box: runBox(r.members),
    }));
    console.log(JSON.stringify({ frame, elements: placed, relations: rels, runs }, null, 2));
    return;
  }

  // Single element: keep the original output exactly.
  if (placed.length === 1) {
    console.log(elementBlock(placed[0].name, args.className, placed[0].placement).replace(
      /^(.*\n)/, `$1  frame ${placed[0].placement.frame.w} x ${placed[0].placement.frame.h}\n`));
    return;
  }

  console.log(`FRAME  ${wOf(frame)} x ${hOf(frame)}   (${frame.x0},${frame.y0})–(${frame.x1},${frame.y1})\n`);
  for (const p of placed) {
    console.log(elementBlock(p.name, args.className, p.placement));
    console.log("");
  }

  const rels = [];
  for (let i = 0; i < placed.length; i += 1)
    for (let j = 0; j < placed.length; j += 1)
      if (i !== j) rels.push(...relate(placed[i], placed[j], args.tolerance));

  const seen = new Set();
  const interesting = rels.filter((r) => {
    if (!r.symmetric) return true;
    const key = `${r.kind}|${[r.of, r.subject].sort().join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (interesting.length) {
    console.log("RELATIONS");
    for (const r of interesting) {
      const extra = r.gap !== undefined ? `  gap ${r.gap}px`
                  : r.delta !== undefined ? `  Δ${r.delta}px` : "";
      console.log(`  ${r.subject.padEnd(16)} ${r.kind.padEnd(22)} ${r.of}${extra}`);
    }
    console.log("");
  }

  const runs = findRuns(placed, args.tolerance);
  if (runs.length) {
    console.log("GROUPS  (a run of aligned, evenly-spaced siblings is a layout, not N positions)");
    for (const r of runs) {
      const b = runBox(r.members);
      const avg = round(r.gaps.reduce((s, g) => s + g, 0) / r.gaps.length);
      const spread = Math.max(...r.gaps) - Math.min(...r.gaps);
      console.log(`  ${r.members.map((m) => m.name).join(" + ")}   [${r.axis.toLowerCase()} run]`);
      console.log(`    gaps ${r.gaps.map(round).join(", ")}px  (mean ${avg}, spread ${round(spread)})`);
      console.log(`    group box: x ${round(b.x0)}–${round(b.x1)}, y ${round(b.y0)}–${round(b.y1)}`);
      if (spread <= Math.max(args.tolerance, 4)) {
        const align = r.axis === "Horizontal" ? "VerticalAlignment = Enum.VerticalAlignment.Center"
                                              : "HorizontalAlignment = Enum.HorizontalAlignment.Center";
        console.log(`    suggests: UIListLayout{ FillDirection = Enum.FillDirection.${r.axis},`);
        console.log(`                            Padding = UDim.new(0, ${avg}), ${align},`);
        console.log(`                            SortOrder = Enum.SortOrder.LayoutOrder }`);
      } else {
        console.log(`    gaps are uneven — position these individually rather than with a layout`);
      }
      console.log(`    place the GROUP against the frame, then its members inside the group`);
      console.log("");
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();

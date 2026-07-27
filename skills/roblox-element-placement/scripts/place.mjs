#!/usr/bin/env node
// Classify where an element sits relative to its owning frame, and emit the exact
// AnchorPoint / Position / Size to reproduce it. Part of the roblox-element-placement skill.
//
// The point of this script: "is it inside?" is a signed-delta question, not an eyeball question.
// A negative delta means the element hangs OUTSIDE that edge — which is normal and idiomatic in
// Roblox, and is the case web-trained instincts silently get wrong.

const HELP = `
place.mjs — classify an element's placement relative to its frame

  node place.mjs --frame <x0,y0,x1,y1> --element <x0,y0,x1,y1> [options]

Options
  --frame <box>       Frame bounding box in reference pixels. Required.
  --element <box>     Element bounding box in reference pixels. Required.
  --name <str>        Element name for the output. Default: Element
  --class <str>       Roblox class for the emitted snippet. Default: Frame
  --tolerance <px>    Overhang smaller than this counts as flush. Default: 3
  --json              Emit JSON instead of the report.
  -h, --help          This text.

Boxes are x0,y0,x1,y1 with y growing downward, matching image coordinates.
`.trim();

function parseArgs(argv) {
  const out = { name: "Element", className: "Frame", tolerance: 3, json: false, help: false };
  const keys = { "--frame": "frame", "--element": "element", "--name": "name", "--class": "className", "--tolerance": "tolerance" };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "-h" || a === "--help") out.help = true;
    else if (a === "--json") out.json = true;
    else if (keys[a]) {
      const v = argv[i + 1];
      if (v === undefined) throw new Error(`${a} requires a value.`);
      out[keys[a]] = v;
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

const round = (n) => Math.round(n);

export function classify(frame, el, tolerance = 3) {
  const fw = frame.x1 - frame.x0;
  const fh = frame.y1 - frame.y0;
  const w = el.x1 - el.x0;
  const h = el.y1 - el.y0;

  // Positive = inside that edge, negative = hanging outside it.
  const d = {
    left: el.x0 - frame.x0,
    top: el.y0 - frame.y0,
    right: frame.x1 - el.x1,
    bottom: frame.y1 - el.y1,
  };

  const cx = (el.x0 + el.x1) / 2 - frame.x0;
  const cy = (el.y0 + el.y1) / 2 - frame.y0;

  const outside = Object.entries(d).filter(([, v]) => v < -tolerance).map(([k]) => k);
  const centreInside = cx >= 0 && cx <= fw && cy >= 0 && cy <= fh;

  // --- anchoring: pick the nearest edge per axis, or the centre if it is genuinely centred
  const near = 0.25; // within this fraction of the frame, anchor to that edge
  const axis = (c, size, extent) => {
    if (Math.abs(c - extent / 2) <= extent * 0.04) return { scale: 0.5, offset: round(c - extent / 2) };
    if (c <= extent * near) return { scale: 0, offset: round(c) };
    if (extent - c <= extent * near) return { scale: 1, offset: round(c - extent) };
    return { scale: Number((c / extent).toFixed(3)), offset: 0 };
  };
  const ax = axis(cx, w, fw);
  const ay = axis(cy, h, fh);

  // --- class
  let cls;
  let detail = "";
  const fills = w >= fw * 0.9 && h >= fh * 0.9;
  const centred = Math.abs(cx - fw / 2) <= fw * 0.04 && Math.abs(cy - fh / 2) <= fh * 0.04;

  if (outside.length && centreInside) {
    cls = "STRADDLE";
    detail = outside
      .map((e) => `${Math.abs(round(d[e]))}px past the ${e} edge`)
      .join(", ");
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

  const fmt = (u) => (u.scale === 0 ? `0, ${u.offset}` : `${u.scale}, ${u.offset}`);
  return {
    class: cls,
    detail,
    size: { w: round(w), h: round(h) },
    frame: { w: round(fw), h: round(fh) },
    deltas: Object.fromEntries(Object.entries(d).map(([k, v]) => [k, round(v)])),
    centre: { x: round(cx), y: round(cy), fx: Number((cx / fw).toFixed(3)), fy: Number((cy / fh).toFixed(3)) },
    anchorPoint: [0.5, 0.5],
    positionLua: `UDim2.new(${fmt(ax)}, ${fmt(ay)})`,
    sizeLua: `UDim2.fromOffset(${round(w)}, ${round(h)})`,
  };
}

function report(name, className, r) {
  const L = [];
  L.push(`${name} (${className})  ${r.size.w} x ${r.size.h}`);
  L.push(`  frame ${r.frame.w} x ${r.frame.h}`);
  L.push(`  edge deltas (positive = inside):  left ${r.deltas.left >= 0 ? "+" : ""}${r.deltas.left}  top ${r.deltas.top >= 0 ? "+" : ""}${r.deltas.top}  right ${r.deltas.right >= 0 ? "+" : ""}${r.deltas.right}  bottom ${r.deltas.bottom >= 0 ? "+" : ""}${r.deltas.bottom}`);
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
  if (!args.frame || !args.element) { console.error("--frame and --element are required.\n\n" + HELP); process.exit(2); }

  let frame, el;
  try {
    frame = parseBox(args.frame, "frame");
    el = parseBox(args.element, "element");
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const r = classify(frame, el, args.tolerance);
  console.log(args.json ? JSON.stringify({ name: args.name, className: args.className, ...r }, null, 2)
                        : report(args.name, args.className, r));
}

if (import.meta.url === `file://${process.argv[1]}`) main();

#!/usr/bin/env node
// convert-image.mjs — convert / resize raster assets for the web, preserving transparency.
//
// Engines, tried in order unless --engine is given:
//   sharp (resolved from the project's node_modules) → ImageMagick (`magick`) → cwebp → ffmpeg (libwebp)
// Never overwrites: an existing target gets a -v2, -v3… suffix unless --overwrite is passed
// (pass it only when the user has explicitly approved replacing that file).
//
// Usage:
//   node convert-image.mjs <input> [--format webp|png|avif|jpeg] [--quality 82] [--lossless]
//        [--widths 640,1280,1920 | --width 1200] [--out <file> | --out-dir <dir>] [--name <base>]
//        [--engine sharp|magick|cwebp|ffmpeg] [--project <dir>] [--overwrite] [--json]
//
// Examples:
//   node convert-image.mjs public/assets/hero.png --format webp --widths 640,1280,1920
//   node convert-image.mjs logo-cutout.png --format webp --lossless --out public/assets/logo.webp

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { rasterInfo } from "./lib/image-info.mjs";

const argv = process.argv.slice(2);
const o = { format: "webp", quality: 82, lossless: false, widths: [], out: null, outDir: null, name: null, engine: null, project: process.cwd(), overwrite: false, json: false };
let input = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  const next = () => argv[++i];
  if (a === "--format") o.format = next().toLowerCase().replace("jpg", "jpeg");
  else if (a === "--quality") o.quality = Number(next());
  else if (a === "--lossless") o.lossless = true;
  else if (a === "--widths") o.widths = next().split(",").map(Number).filter(Boolean);
  else if (a === "--width") o.widths = [Number(next())];
  else if (a === "--out") o.out = next();
  else if (a === "--out-dir") o.outDir = next();
  else if (a === "--name") o.name = next();
  else if (a === "--engine") o.engine = next();
  else if (a === "--project") o.project = path.resolve(next());
  else if (a === "--overwrite") o.overwrite = true;
  else if (a === "--json") o.json = true;
  else if (a.startsWith("--")) fail(`unknown option ${a}`, 2);
  else input = a;
}
function fail(msg, code = 1) { console.error(`convert-image: ${msg}`); process.exit(code); }
if (!input) fail("usage: node convert-image.mjs <input> [--format webp] [--widths 640,1280] [--out file | --out-dir dir]", 2);
if (!fs.existsSync(input)) fail(`input not found: ${input}`);
if (!["webp", "png", "avif", "jpeg"].includes(o.format)) fail(`unsupported --format ${o.format}`, 2);
if (o.out && o.widths.length > 1) fail("--out takes one file; use --out-dir with several --widths", 2);

const src = rasterInfo(fs.readFileSync(input));
if (!src.width) fail(`cannot read input dimensions (format: ${src.format}); rasterise SVG inputs first with render-preview.mjs --rasterize`);
const hasAlpha = !!src.hasAlphaChannel;
if (o.format === "jpeg" && hasAlpha) console.warn("convert-image: WARNING input has an alpha channel; JPEG will flatten transparency onto white");

// ---------- engines ----------
const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8", windowsHide: true });
const has = (cmd, args, re) => { const r = run(cmd, args); return !r.error && re.test(`${r.stdout}${r.stderr}`); };
let sharp = null;
try { sharp = createRequire(path.join(o.project, "package.json"))("sharp"); } catch { /* not installed */ }

const engines = {
  sharp: {
    ok: () => !!sharp,
    async convert(inp, out, width) {
      let img = sharp(inp, { animated: false });
      if (width) img = img.resize({ width, withoutEnlargement: true });
      if (o.format === "webp") img = img.webp(o.lossless ? { lossless: true, effort: 5 } : { quality: o.quality, alphaQuality: 100, effort: 5 });
      if (o.format === "avif") img = img.avif(o.lossless ? { lossless: true } : { quality: Math.min(o.quality, 70), effort: 4 });
      if (o.format === "png") img = img.png({ compressionLevel: 9, adaptiveFiltering: true });
      if (o.format === "jpeg") img = img.flatten({ background: "#ffffff" }).jpeg({ quality: o.quality, mozjpeg: true });
      await img.toFile(out);
    },
  },
  magick: {
    ok: () => has("magick", ["-version"], /ImageMagick/),
    async convert(inp, out, width) {
      const a = [inp];
      if (width) a.push("-resize", `${width}x>`);
      if (o.format === "webp") a.push(...(o.lossless ? ["-define", "webp:lossless=true"] : ["-quality", String(o.quality), "-define", "webp:alpha-quality=100"]), "-define", "webp:method=5");
      else if (o.format === "jpeg") a.push("-background", "white", "-flatten", "-quality", String(o.quality));
      else if (o.format === "avif") a.push("-quality", String(Math.min(o.quality, 70)));
      a.push("-strip", out);
      const r = run("magick", a);
      if (r.status !== 0) throw new Error(r.stderr || "magick failed");
    },
  },
  cwebp: {
    ok: () => o.format === "webp" && has("cwebp", ["-version"], /^\s*\d/),
    async convert(inp, out, width) {
      const a = o.lossless ? ["-lossless", "-exact"] : ["-q", String(o.quality), "-alpha_q", "100"];
      a.push("-m", "5", "-metadata", "none");
      if (width && width < src.width) a.push("-resize", String(width), "0");
      a.push(inp, "-o", out);
      const r = run("cwebp", a);
      if (r.status !== 0) throw new Error(r.stderr || "cwebp failed");
    },
  },
  ffmpeg: {
    ok: () => ["webp", "png"].includes(o.format) && has("ffmpeg", ["-hide_banner", "-encoders"], o.format === "webp" ? /libwebp/ : /png/),
    async convert(inp, out, width) {
      const a = ["-hide_banner", "-loglevel", "error", "-n", "-i", inp, "-frames:v", "1"];
      if (width && width < src.width) a.push("-vf", `scale=${width}:-2:flags=lanczos`);
      if (o.format === "webp") {
        a.push("-c:v", "libwebp", ...(o.lossless ? ["-lossless", "1"] : ["-quality", String(o.quality)]));
        if (hasAlpha) a.push("-pix_fmt", "yuva420p");
      }
      a.push(out);
      const r = run("ffmpeg", a);
      if (r.status !== 0) throw new Error(r.stderr || "ffmpeg failed");
    },
  },
};

const order = o.engine ? [o.engine] : ["sharp", "magick", "cwebp", "ffmpeg"];
const engineName = order.find((n) => engines[n]?.ok());
if (!engineName) {
  fail(`no converter available for ${o.format}${o.engine ? ` with engine ${o.engine}` : ""}. Install one: npm i -D sharp (recommended), ImageMagick 7, or libwebp (cwebp).`);
}

// ---------- targets ----------
const ext = o.format === "jpeg" ? "jpg" : o.format;
const base = o.name ?? path.basename(input, path.extname(input));
const dir = o.outDir ?? (o.out ? path.dirname(o.out) : path.dirname(input));
fs.mkdirSync(dir, { recursive: true });
const widths = o.widths.length ? o.widths : [null];
function freePath(p) {
  if (o.overwrite || !fs.existsSync(p)) return p;
  const e = path.extname(p), b = p.slice(0, -e.length);
  for (let v = 2; ; v++) { const c = `${b}-v${v}${e}`; if (!fs.existsSync(c)) return c; }
}

const results = [];
const produced = new Set();
for (const w of widths) {
  const effective = w ? Math.min(w, src.width) : src.width;
  if (w && w > src.width) console.warn(`convert-image: width ${w} exceeds source width ${src.width}; output stays at ${src.width} (no upscaling)`);
  if (produced.has(effective)) { console.warn(`convert-image: skipping duplicate ${effective}px variant`); continue; }
  produced.add(effective);
  let target = o.out ?? path.join(dir, `${base}${w ? `-${effective}w` : ""}.${ext}`);
  if (path.resolve(target) === path.resolve(input)) fail("output would replace the input; choose another --out/--name");
  const requested = target;
  target = freePath(target);
  // ffmpeg -n refuses to overwrite; with --overwrite remove first so the user-approved replace works
  if (o.overwrite && fs.existsSync(target) && engineName === "ffmpeg") fs.rmSync(target);
  await engines[engineName].convert(input, target, w && w < src.width ? w : null);
  const outInfo = rasterInfo(fs.readFileSync(target));
  const res = {
    input, output: target, renamedFrom: target !== requested ? requested : undefined, engine: engineName,
    format: outInfo.format, width: outInfo.width, height: outInfo.height,
    inputBytes: fs.statSync(input).size, outputBytes: fs.statSync(target).size,
    sourceHasAlpha: hasAlpha, outputHasAlpha: !!outInfo.hasAlphaChannel,
  };
  res.alphaPreserved = !hasAlpha || res.outputHasAlpha || o.format === "jpeg";
  results.push(res);
}

if (o.json) console.log(JSON.stringify(results, null, 2));
else for (const r of results) {
  const pct = (((r.outputBytes - r.inputBytes) / r.inputBytes) * 100).toFixed(0);
  console.log(`${r.alphaPreserved ? "OK  " : "FAIL"} ${r.output}  [${r.format} ${r.width}×${r.height}, ${(r.outputBytes / 1024).toFixed(1)} KB (${pct}% vs source), engine ${r.engine}${r.sourceHasAlpha ? `, alpha ${r.outputHasAlpha ? "preserved" : r.format === "jpeg" ? "flattened onto white (JPEG has no alpha)" : "LOST"}` : ""}]`);
  if (r.renamedFrom) console.log(`     (${r.renamedFrom} already existed — wrote a versioned file instead)`);
}
process.exit(results.every((r) => r.alphaPreserved) ? 0 : 1);

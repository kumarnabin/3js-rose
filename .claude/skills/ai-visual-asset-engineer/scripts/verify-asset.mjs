#!/usr/bin/env node
// verify-asset.mjs — validate image assets without external dependencies.
//
// Raster (PNG, WebP, JPEG, GIF, AVIF): real format from magic bytes, dimensions, alpha channel,
// and for 8-bit non-interlaced PNGs the share of transparent pixels (catches "fake" transparency).
// SVG: XML well-formedness, root <svg>, xmlns, viewBox, accessible name, duplicate ids,
// embedded rasters, scripts / event handlers, external references.
//
// Usage:
//   node verify-asset.mjs <file...> [--expect-alpha] [--expect-format webp] [--min-width 512]
//        [--max-bytes 300000] [--allow-raster-in-svg] [--json]
// Exit code: 0 = no errors, 1 = at least one error, 2 = bad usage.

import fs from "node:fs";
import path from "node:path";
import { sniff, readPng, readWebp, readJpeg, readGif, readAvif, checkSvg } from "./lib/image-info.mjs";

const args = process.argv.slice(2);
const opts = { files: [], expectAlpha: false, expectFormat: null, minWidth: 0, maxBytes: 0, allowRaster: false, json: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--expect-alpha") opts.expectAlpha = true;
  else if (a === "--expect-format") opts.expectFormat = args[++i]?.toLowerCase();
  else if (a === "--min-width") opts.minWidth = Number(args[++i]);
  else if (a === "--max-bytes") opts.maxBytes = Number(args[++i]);
  else if (a === "--allow-raster-in-svg") opts.allowRaster = true;
  else if (a === "--json") opts.json = true;
  else if (a.startsWith("--")) { console.error(`Unknown option ${a}`); process.exit(2); }
  else opts.files.push(a);
}
if (!opts.files.length) {
  console.error("Usage: node verify-asset.mjs <file...> [--expect-alpha] [--expect-format png|webp|svg|jpeg] [--min-width N] [--max-bytes N] [--allow-raster-in-svg] [--json]");
  process.exit(2);
}

// ---------- main ----------
const results = [];
for (const file of opts.files) {
  const r = { file, errors: [], warnings: [], info: {} };
  results.push(r);
  if (!fs.existsSync(file)) { r.errors.push("file does not exist"); continue; }
  const buf = fs.readFileSync(file);
  r.info.bytes = buf.length;
  if (!buf.length) { r.errors.push("file is empty"); continue; }
  const format = sniff(buf);
  r.info.format = format;
  const ext = path.extname(file).slice(1).toLowerCase().replace("jpg", "jpeg");
  if (ext && format !== "unknown" && ext !== format) r.errors.push(`extension .${ext} does not match actual format ${format}`);
  if (opts.expectFormat && format !== opts.expectFormat.replace("jpg", "jpeg")) r.errors.push(`expected ${opts.expectFormat}, got ${format}`);
  try {
    if (format === "png") Object.assign(r.info, readPng(buf));
    else if (format === "webp") Object.assign(r.info, readWebp(buf));
    else if (format === "jpeg") Object.assign(r.info, readJpeg(buf));
    else if (format === "gif") Object.assign(r.info, readGif(buf));
    else if (format === "avif") Object.assign(r.info, readAvif(buf));
    else if (format === "svg") {
      const s = checkSvg(buf.toString("utf8"), { allowRaster: opts.allowRaster });
      Object.assign(r.info, s.info); r.errors.push(...s.errors); r.warnings.push(...s.warnings);
    } else if (format === "unknown") r.errors.push("unrecognised format (not PNG/JPEG/WebP/GIF/AVIF/SVG)");
  } catch (e) {
    r.errors.push(`could not parse ${format}: ${e.message}`);
  }
  if (format !== "svg" && format !== "unknown") {
    if (opts.minWidth && r.info.width && r.info.width < opts.minWidth) r.errors.push(`width ${r.info.width} < required ${opts.minWidth}`);
    if (opts.expectAlpha) {
      if (!r.info.hasAlphaChannel) r.errors.push("no alpha channel: background is not transparent");
      else if (r.info.transparentPixelRatio === 0) r.errors.push("alpha channel present but 0 transparent pixels: transparency is fake (e.g. baked-in checkerboard or solid background)");
      else if (r.info.cornersTransparent === false) r.warnings.push("corners are not transparent: check for leftover background");
    }
  }
  if (opts.maxBytes && buf.length > opts.maxBytes) r.errors.push(`size ${buf.length} B > budget ${opts.maxBytes} B`);
}

if (opts.json) console.log(JSON.stringify(results, null, 2));
else {
  for (const r of results) {
    const i = r.info;
    const dims = i.width && i.height ? `${i.width}×${i.height}` : i.viewBox ? `viewBox ${i.viewBox}` : "";
    const alpha = i.hasAlphaChannel === undefined ? "" : i.hasAlphaChannel ? `alpha${i.transparentPixelRatio !== undefined ? ` (${(i.transparentPixelRatio * 100).toFixed(1)}% transparent)` : ""}` : "opaque";
    console.log(`${r.errors.length ? "FAIL" : "PASS"}  ${r.file}  [${i.format ?? "?"}${dims ? ", " + dims : ""}${alpha ? ", " + alpha : ""}${i.bytes ? ", " + (i.bytes / 1024).toFixed(1) + " KB" : ""}]`);
    r.errors.forEach((e) => console.log(`  ERROR ${e}`));
    r.warnings.forEach((w) => console.log(`  WARN  ${w}`));
  }
}
process.exit(results.some((r) => r.errors.length) ? 1 : 0);

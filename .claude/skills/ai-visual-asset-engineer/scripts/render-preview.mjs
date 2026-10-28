#!/usr/bin/env node
// render-preview.mjs — render assets in a real browser (Playwright/Chromium).
//
// Preview mode (default): loads every asset as <img> on light, dark and checkerboard backgrounds,
// reports load failures and console errors, and saves a contact-sheet screenshot you can inspect.
// Rasterize mode: renders one SVG to a transparent PNG at an exact width.
//
// Requires Playwright resolvable from the project (npm i -D @playwright/test && npx playwright install chromium).
//
// Usage:
//   node render-preview.mjs <asset...> [--out preview.png] [--project dir]
//   node render-preview.mjs icon.svg --rasterize --width 512 --out icon-512.png [--project dir]

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const argv = process.argv.slice(2);
const o = { files: [], out: null, project: process.cwd(), rasterize: false, width: 512 };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--out") o.out = argv[++i];
  else if (a === "--project") o.project = path.resolve(argv[++i]);
  else if (a === "--rasterize") o.rasterize = true;
  else if (a === "--width") o.width = Number(argv[++i]);
  else if (a.startsWith("--")) { console.error(`unknown option ${a}`); process.exit(2); }
  else o.files.push(path.resolve(a));
}
if (!o.files.length) { console.error("usage: node render-preview.mjs <asset...> [--out preview.png] | <file.svg> --rasterize --width 512 --out file.png"); process.exit(2); }
for (const f of o.files) if (!fs.existsSync(f)) { console.error(`not found: ${f}`); process.exit(1); }

let chromium;
const req = createRequire(path.join(o.project, "package.json"));
for (const mod of ["playwright", "@playwright/test", "playwright-core"]) {
  try { ({ chromium } = req(mod)); break; } catch { /* try next */ }
}
if (!chromium) {
  console.error("render-preview: Playwright not found from the project. Install: npm i -D @playwright/test && npx playwright install chromium\nWithout it, verify rendering manually in a browser and say so in the report.");
  process.exit(3);
}

const browser = await chromium.launch().catch((e) => {
  console.error(`render-preview: could not launch Chromium (${e.message.split("\n")[0]}). Run: npx playwright install chromium`);
  process.exit(3);
});
const page = await browser.newPage({ deviceScaleFactor: 1 });
const consoleErrors = [];
const failedRequests = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
page.on("pageerror", (e) => consoleErrors.push(e.message));
page.on("requestfailed", (r) => failedRequests.push(`${r.url()} (${r.failure()?.errorText})`));

// Serve the page and assets from a fake origin with real content types (file:// is blocked, and
// a web server is how assets are actually delivered — SVG must arrive as image/svg+xml).
const ORIGIN = "http://assets.preview";
const TYPES = { svg: "image/svg+xml", png: "image/png", webp: "image/webp", avif: "image/avif", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif" };
let html = "";
const assetUrl = (i) => `${ORIGIN}/a/${i}/${encodeURIComponent(path.basename(o.files[i]))}`;
await page.route(`${ORIGIN}/**`, (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
  const m = u.pathname.match(/^\/a\/(\d+)\//);
  const file = m && o.files[+m[1]];
  if (!file) return route.fulfill({ status: 404, body: "" });
  const ext = path.extname(file).slice(1).toLowerCase();
  return route.fulfill({ contentType: TYPES[ext] ?? "application/octet-stream", body: fs.readFileSync(file) });
});
const show = async (markup) => { html = markup; await page.goto(`${ORIGIN}/`); };

let exitCode = 0;
try {
  if (o.rasterize) {
    const file = o.files[0];
    if (!/\.svg$/i.test(file)) throw new Error("--rasterize expects an .svg input");
    const out = path.resolve(o.out ?? file.replace(/\.svg$/i, `-${o.width}w.png`));
    if (fs.existsSync(out)) throw new Error(`${out} exists; choose a new --out (never overwrite without permission)`);
    await show(`<!doctype html><html><body style="margin:0;background:transparent"><img id="a" src="${assetUrl(0)}" style="display:block;width:${o.width}px;height:auto"></body></html>`);
    const img = page.locator("#a");
    await img.evaluate((el) => (el.complete ? null : new Promise((r) => { el.onload = el.onerror = r; })));
    const ok = await img.evaluate((el) => el.naturalWidth > 0);
    if (!ok) throw new Error("SVG failed to load as an image (check xmlns, well-formedness, external refs)");
    await img.screenshot({ path: out, omitBackground: true });
    console.log(`OK   rasterized ${path.basename(file)} -> ${out} (${o.width}px wide, transparent background)`);
  } else {
    const out = path.resolve(o.out ?? "asset-preview.png");
    const cells = o.files.map((f, i) => `
      <figure><div class="row">
        <div class="bg light"><img data-i="${i}" src="${assetUrl(i)}"></div>
        <div class="bg dark"><img src="${assetUrl(i)}"></div>
        <div class="bg check"><img src="${assetUrl(i)}"></div>
      </div><figcaption>${path.basename(f)}</figcaption></figure>`).join("");
    await page.setViewportSize({ width: 1200, height: 800 });
    await show(`<!doctype html><html><head><style>
      body{margin:16px;font:13px system-ui;background:#f4f4f5;color:#18181b}
      figure{margin:0 0 16px} .row{display:flex;gap:8px}
      .bg{width:360px;height:220px;display:grid;place-items:center;border-radius:8px;overflow:hidden}
      .light{background:#fff}.dark{background:#18181b}
      .check{background:repeating-conic-gradient(#d4d4d8 0 25%,#fff 0 50%) 0 0/16px 16px}
      img{max-width:90%;max-height:90%}
      </style></head><body>${cells}</body></html>`);
    const states = await page.$$eval("img[data-i]", (imgs) => Promise.all(imgs.map((el) =>
      (el.complete ? Promise.resolve() : new Promise((r) => { el.onload = el.onerror = r; })).then(() => ({ i: +el.dataset.i, w: el.naturalWidth, h: el.naturalHeight })))));
    for (const s of states) {
      const f = o.files[s.i];
      if (!s.w) { exitCode = 1; console.log(`FAIL ${f}  did not render in Chromium`); }
      else console.log(`OK   ${f}  rendered (intrinsic ${s.w}×${s.h})`);
    }
    if (fs.existsSync(out)) throw new Error(`${out} exists; pass a new --out`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`preview screenshot: ${out}  (open it and look: light / dark / checkerboard)`);
  }
} catch (e) {
  exitCode = 1;
  console.error(`render-preview: ${e.message}`);
}
if (consoleErrors.length) { exitCode = 1; consoleErrors.forEach((e) => console.log(`CONSOLE ERROR ${e}`)); }
failedRequests.forEach((r) => console.log(`REQUEST FAILED ${r}`));
await browser.close();
process.exit(exitCode);

#!/usr/bin/env node
// detect-environment.mjs — report what this machine and project can do for asset work.
//
// It CANNOT see the agent's own tools (built-in image generation, MCP servers). The agent must
// check its tool list separately; this script covers the project, local converters and API keys.
//
// Usage: node detect-environment.mjs [projectDir] [--json]

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const root = path.resolve(argv.find((a) => !a.startsWith("--")) ?? process.cwd());

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: "utf8", timeout: 15000, shell: false, windowsHide: true });
  return r.error ? null : `${r.stdout ?? ""}${r.stderr ?? ""}`;
};
const firstLine = (s) => s?.split(/\r?\n/).find(Boolean)?.trim();

// ---------- project ----------
const project = { root, packageJson: false };
const pkgPath = path.join(root, "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const has = (n) => (deps[n] ? `${n}@${deps[n]}` : null);
  project.packageJson = true;
  project.name = pkg.name;
  project.framework =
    has("next") ?? has("@remix-run/react") ?? has("react-router") ?? has("astro") ?? has("@angular/core") ?? has("vue") ?? has("svelte") ?? has("react") ?? (has("three") ? "vanilla three.js" : "none detected");
  project.react = has("react");
  project.bundler = has("vite") ?? has("next") ?? has("webpack") ?? has("parcel") ?? has("@rsbuild/core") ?? null;
  project.typescript = !!deps.typescript || fs.existsSync(path.join(root, "tsconfig.json"));
  project.tailwind = has("tailwindcss");
  project.svgr = has("vite-plugin-svgr") ?? has("@svgr/webpack") ?? has("@svgr/cli") ?? (deps.next ? "check next.config for @svgr/webpack" : null);
  project.imageTooling = ["sharp", "svgo", "@playwright/test", "playwright", "vite-plugin-image-optimizer", "vite-imagetools"].filter((n) => deps[n]);
}
const dirs = ["public/assets", "public/images", "public/img", "public/icons", "public", "src/assets", "src/assets/images", "src/assets/icons", "src/icons", "assets", "static"];
project.assetDirs = dirs.filter((d) => fs.existsSync(path.join(root, d))).map((d) => {
  const counts = {};
  const walk = (dir, depth) => {
    if (depth > 3) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else {
        const ext = path.extname(e.name).slice(1).toLowerCase();
        if (["png", "jpg", "jpeg", "webp", "avif", "gif", "svg", "glb", "gltf", "hdr", "ico"].includes(ext)) counts[ext] = (counts[ext] ?? 0) + 1;
      }
    }
  };
  walk(path.join(root, d), 0);
  return { dir: d, files: counts };
});
// Root-level images (some projects keep assets next to index.html)
project.rootImages = fs.existsSync(root) ? fs.readdirSync(root).filter((f) => /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(f)) : [];

// ---------- local tools ----------
const tools = {};
try {
  // sharp's "exports" hide package.json, so resolve the entry point and walk up to its package.json.
  // Node resolution also searches parent directories, so report where it was found.
  let dir = path.dirname(createRequire(path.join(root, "package.json")).resolve("sharp"));
  while (!fs.existsSync(path.join(dir, "package.json")) && path.dirname(dir) !== dir) dir = path.dirname(dir);
  const sharpPkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const inProject = path.resolve(dir).startsWith(path.resolve(root));
  tools.sharp = { available: true, version: sharpPkg.version, where: inProject ? "project node_modules" : `outside project: ${dir} (add it to the project: npm i -D sharp)` };
} catch {
  tools.sharp = { available: false, hint: "npm i -D sharp  (in the project), or use another converter" };
}
const im = run("magick", ["-version"]);
tools.imagemagick = im && /ImageMagick/.test(im) ? { available: true, version: firstLine(im), cmd: "magick" } : { available: false };
if (!tools.imagemagick.available) {
  // ImageMagick 6 uses `convert`; on Windows `convert` is usually C:\Windows\System32\convert.exe (a disk tool) — verify!
  const im6 = run("convert", ["-version"]);
  if (im6 && /ImageMagick/.test(im6)) tools.imagemagick = { available: true, version: firstLine(im6), cmd: "convert" };
  else if (process.platform === "win32") tools.imagemagick.note = "`convert` on Windows is the system disk utility, not ImageMagick — never call it";
}
const cw = run("cwebp", ["-version"]);
tools.cwebp = cw && /^\d/.test(cw.trim()) ? { available: true, version: firstLine(cw) } : { available: false };
const ff = run("ffmpeg", ["-hide_banner", "-encoders"]);
tools.ffmpeg = ff ? { available: true, libwebp: /libwebp/.test(ff), libaom: /libaom|libsvtav1/.test(ff) } : { available: false };
const localBin = (n) => [path.join(root, "node_modules", ".bin", n), path.join(root, "node_modules", ".bin", `${n}.cmd`)].find((p) => fs.existsSync(p));
const svgoLocal = localBin("svgo");
const svgoGlobal = svgoLocal ? null : run("svgo", ["--version"]);
tools.svgo = svgoLocal ? { available: true, where: "project" } : svgoGlobal && /^\d/.test(svgoGlobal.trim()) ? { available: true, version: firstLine(svgoGlobal), where: "global" } : { available: false, hint: "npx svgo@latest (downloads on first use) or npm i -D svgo" };
tools.playwright = localBin("playwright") ? { available: true, where: "project" } : { available: false, hint: "npm i -D @playwright/test && npx playwright install chromium" };
const rb = run("rembg", ["--help"]);
tools.rembg = rb && /rembg/i.test(rb) ? { available: true } : { available: false };
tools.node = process.version;

// ---------- API credentials (presence only, never values) ----------
const keyNames = {
  openai: ["OPENAI_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  replicate: ["REPLICATE_API_TOKEN"],
  fal: ["FAL_KEY"],
  stability: ["STABILITY_API_KEY"],
  recraft: ["RECRAFT_API_TOKEN"],
};
const credentials = Object.fromEntries(Object.entries(keyNames).map(([p, names]) => [p, names.find((n) => process.env[n]) ?? null]));

// ---------- agent hints (best-effort; env vars only) ----------
const agentHints = [];
if (process.env.CLAUDECODE) agentHints.push("Claude Code (CLAUDECODE is set)");
if (Object.keys(process.env).some((k) => k.startsWith("CODEX_"))) agentHints.push("Codex (CODEX_* env present)");
if (Object.keys(process.env).some((k) => /ANTIGRAVITY/i.test(k))) agentHints.push("Antigravity (ANTIGRAVITY* env present)");
if (Object.keys(process.env).some((k) => k.startsWith("GEMINI_CLI"))) agentHints.push("Gemini CLI");

// ---------- summary ----------
const converter = tools.sharp.available ? "sharp" : tools.imagemagick.available ? "imagemagick" : tools.cwebp.available ? "cwebp" : tools.ffmpeg.libwebp ? "ffmpeg" : null;
const apiProviders = Object.entries(credentials).filter(([, v]) => v).map(([k]) => k);
const report = {
  project,
  tools,
  credentials,
  agentHints,
  summary: {
    webpConverter: converter ?? "none — install sharp in the project (npm i -D sharp)",
    rasterGenerationViaScript: apiProviders.filter((p) => ["openai", "gemini"].includes(p)),
    otherApiCredentials: apiProviders.filter((p) => !["openai", "gemini"].includes(p)),
    reminder: "Also inspect your own tool list for built-in or MCP image-generation tools; this script cannot see them.",
  },
};

if (json) console.log(JSON.stringify(report, null, 2));
else {
  const y = (b) => (b ? "yes" : "no");
  console.log(`Project: ${root}`);
  if (project.packageJson) {
    console.log(`  framework: ${project.framework} | bundler: ${project.bundler ?? "?"} | TS: ${y(project.typescript)} | Tailwind: ${project.tailwind ?? "no"} | SVGR: ${project.svgr ?? "no"}`);
    if (project.imageTooling.length) console.log(`  image tooling deps: ${project.imageTooling.join(", ")}`);
  } else console.log("  no package.json");
  console.log(`  asset dirs: ${project.assetDirs.map((d) => `${d.dir} ${JSON.stringify(d.files)}`).join("; ") || "none"}`);
  if (project.rootImages.length) console.log(`  root-level images: ${project.rootImages.join(", ")}`);
  console.log("Local tools:");
  console.log(`  sharp: ${tools.sharp.available ? tools.sharp.version : "no"} | ImageMagick: ${tools.imagemagick.available ? tools.imagemagick.cmd : "no"}${tools.imagemagick.note ? ` (${tools.imagemagick.note})` : ""}`);
  console.log(`  cwebp: ${y(tools.cwebp.available)} | ffmpeg: ${tools.ffmpeg.available ? `yes (libwebp: ${y(tools.ffmpeg.libwebp)})` : "no"} | svgo: ${tools.svgo.available ? tools.svgo.where : "no"} | playwright: ${tools.playwright.available ? "project" : "no"} | rembg: ${y(tools.rembg.available)} | node ${tools.node}`);
  console.log(`API credentials present: ${apiProviders.length ? apiProviders.map((p) => `${p} (${credentials[p]})`).join(", ") : "none"}`);
  if (agentHints.length) console.log(`Agent hints: ${agentHints.join(", ")}`);
  console.log(`=> WebP converter: ${report.summary.webpConverter}`);
  console.log(`=> Raster generation via bundled script: ${report.summary.rasterGenerationViaScript.join(", ") || "not available (no OPENAI/GEMINI key)"}`);
  console.log(`=> ${report.summary.reminder}`);
}

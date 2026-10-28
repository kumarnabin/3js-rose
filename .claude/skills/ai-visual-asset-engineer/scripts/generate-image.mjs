#!/usr/bin/env node
// generate-image.mjs — call an image-generation API the user has a key for, save the real file.
//
// Providers: openai (Images API), gemini (Gemini API generateContent), replicate (any model).
// SAFETY: without --confirm this only prints the request plan (nothing is sent). A real call
// costs money on the user's account and sends the prompt (and reference images) to the provider —
// get the user's approval first, then re-run with --confirm.
// Never overwrites: existing targets get -v2, -v3…  Writes <file>.asset.json with prompt + settings.
//
// Usage:
//   node generate-image.mjs --provider openai|gemini|replicate --prompt "…" | --prompt-file p.txt
//        --out public/assets/hero.png [--model ID] [--ref img.png ...] [--transparent]
//        [--size 1536x1024] [--quality high] [--format png|webp|jpeg] [--n 1]      (openai)
//        [--aspect 16:9] [--image-size 2K]                                         (gemini)
//        [--input-json '{"aspect_ratio":"16:9"}']                                  (replicate)
//        [--confirm] [--json]
//   node generate-image.mjs --provider openai|gemini --list-models

import fs from "node:fs";
import path from "node:path";
import { rasterInfo } from "./lib/image-info.mjs";

const argv = process.argv.slice(2);
const o = { provider: null, prompt: null, out: null, model: null, refs: [], transparent: false, size: null, quality: null, format: null, n: 1, aspect: null, imageSize: null, inputJson: null, confirm: false, listModels: false, json: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i], next = () => argv[++i];
  if (a === "--provider") o.provider = next();
  else if (a === "--prompt") o.prompt = next();
  else if (a === "--prompt-file") o.prompt = fs.readFileSync(next(), "utf8").trim();
  else if (a === "--out") o.out = next();
  else if (a === "--model") o.model = next();
  else if (a === "--ref") o.refs.push(next());
  else if (a === "--transparent") o.transparent = true;
  else if (a === "--size") o.size = next();
  else if (a === "--quality") o.quality = next();
  else if (a === "--format") o.format = next();
  else if (a === "--n") o.n = Number(next());
  else if (a === "--aspect") o.aspect = next();
  else if (a === "--image-size") o.imageSize = next();
  else if (a === "--input-json") o.inputJson = JSON.parse(next());
  else if (a === "--confirm") o.confirm = true;
  else if (a === "--list-models") o.listModels = true;
  else if (a === "--json") o.json = true;
  else die(`unknown option ${a}`, 2);
}
function die(msg, code = 1) { console.error(`generate-image: ${msg}`); process.exit(code); }

const KEYS = { openai: ["OPENAI_API_KEY"], gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], replicate: ["REPLICATE_API_TOKEN"] };
if (!KEYS[o.provider]) die("--provider must be openai, gemini or replicate", 2);
const keyName = KEYS[o.provider].find((k) => process.env[k]);
const key = keyName ? process.env[keyName] : null;
// Model ids change often; defaults can be overridden per provider and should be checked with --list-models.
const DEFAULT_MODEL = {
  openai: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
  gemini: process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image",
  replicate: process.env.REPLICATE_IMAGE_MODEL ?? "black-forest-labs/flux-schnell",
};
const model = o.model ?? DEFAULT_MODEL[o.provider];
const TIMEOUT_MS = 5 * 60 * 1000; // high-quality generations can take minutes

async function api(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) {
    const msg = body?.error?.message ?? body?.detail ?? (typeof body === "string" ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500));
    die(`${o.provider} API ${res.status}: ${msg}`);
  }
  return body;
}

// ---------- --list-models ----------
if (o.listModels) {
  if (!key) die(`${KEYS[o.provider].join(" or ")} is not set`);
  if (o.provider === "openai") {
    const r = await api("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } });
    console.log(r.data.map((m) => m.id).filter((id) => /image/i.test(id)).sort().join("\n") || "(no image models visible to this key)");
  } else if (o.provider === "gemini") {
    const r = await api("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000", { headers: { "x-goog-api-key": key } });
    console.log(r.models.filter((m) => /image/i.test(m.name)).map((m) => `${m.name.replace("models/", "")}  ${m.supportedGenerationMethods?.join(",") ?? ""}`).join("\n"));
  } else die("--list-models is supported for openai and gemini; browse https://replicate.com/collections for Replicate");
  process.exit(0);
}

// ---------- validation ----------
if (!o.prompt) die("--prompt or --prompt-file is required", 2);
if (!o.out) die("--out is required (final path inside the project, e.g. public/assets/hero-coffee.png)", 2);
for (const r of o.refs) if (!fs.existsSync(r)) die(`reference image not found: ${r}`);
if (o.transparent && o.provider === "gemini") {
  die("Gemini image models do not output real transparency (alpha). Generate on a flat chroma background (see prompt-templates §4) and remove it (asset-conversion-workflow §6), or use a provider with transparent output.");
}
if (o.transparent && o.format === "jpeg") die("--transparent needs png or webp output", 2);

const MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
const mimeOf = (f) => MIME[path.extname(f).slice(1).toLowerCase()] ?? "application/octet-stream";

// ---------- build request ----------
let plan;
if (o.provider === "openai") {
  const format = o.format ?? (path.extname(o.out).slice(1).toLowerCase().replace("jpg", "jpeg") || "png");
  const params = { model, prompt: o.prompt, n: o.n, size: o.size ?? "auto", ...(o.quality && { quality: o.quality }), output_format: ["png", "webp", "jpeg"].includes(format) ? format : "png", ...(o.transparent && { background: "transparent" }) };
  plan = { endpoint: o.refs.length ? "POST https://api.openai.com/v1/images/edits (multipart, image[] = references)" : "POST https://api.openai.com/v1/images/generations", params, references: o.refs };
} else if (o.provider === "gemini") {
  const parts = [{ text: o.prompt }, ...o.refs.map((r) => ({ inline_data: { mime_type: mimeOf(r), data: `<base64 of ${r}>` } }))];
  const generationConfig = { responseModalities: ["TEXT", "IMAGE"], ...((o.aspect || o.imageSize) && { imageConfig: { ...(o.aspect && { aspectRatio: o.aspect }), ...(o.imageSize && { imageSize: o.imageSize }) } }) };
  plan = { endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, body: { contents: [{ parts }], generationConfig } };
} else {
  plan = { endpoint: `POST https://api.replicate.com/v1/models/${model}/predictions (Prefer: wait)`, body: { input: { prompt: o.prompt, ...o.inputJson } } };
  if (o.refs.length) die("pass reference images for Replicate through --input-json using the model's own input name (schemas differ per model)");
}

if (!o.confirm) {
  console.log(JSON.stringify({ dryRun: true, provider: o.provider, model, credential: keyName ?? `MISSING (${KEYS[o.provider].join(" or ")})`, out: o.out, ...plan }, null, 2));
  console.log("\nNothing was sent. This call is billed to the user's account and sends the prompt/references to the provider. After the user approves, re-run with --confirm.");
  process.exit(key ? 0 : 1);
}
if (!key) die(`${KEYS[o.provider].join(" or ")} is not set — see image-generation-integrations.md to connect a provider`);

// ---------- call ----------
const images = []; // { buf, mime }
let providerText = "";
if (o.provider === "openai") {
  let r;
  if (o.refs.length) {
    const form = new FormData();
    for (const [k, v] of Object.entries(plan.params)) form.append(k, String(v));
    for (const ref of o.refs) form.append("image[]", new Blob([fs.readFileSync(ref)], { type: mimeOf(ref) }), path.basename(ref));
    r = await api("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  } else {
    r = await api("https://api.openai.com/v1/images/generations", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify(plan.params) });
  }
  for (const d of r.data ?? []) if (d.b64_json) images.push({ buf: Buffer.from(d.b64_json, "base64"), mime: MIME[r.output_format ?? plan.params.output_format] });
  plan.response = { size: r.size, quality: r.quality, background: r.background, usage: r.usage };
} else if (o.provider === "gemini") {
  const body = structuredClone(plan.body);
  body.contents[0].parts = [{ text: o.prompt }, ...o.refs.map((r) => ({ inline_data: { mime_type: mimeOf(r), data: fs.readFileSync(r).toString("base64") } }))];
  const r = await api(plan.endpoint.replace("POST ", ""), { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  for (const part of r.candidates?.[0]?.content?.parts ?? []) {
    const inline = part.inlineData ?? part.inline_data;
    if (inline?.data) images.push({ buf: Buffer.from(inline.data, "base64"), mime: inline.mimeType ?? inline.mime_type });
    else if (part.text) providerText += part.text;
  }
  if (!images.length) die(`no image returned. finishReason=${r.candidates?.[0]?.finishReason ?? "?"} ${r.promptFeedback ? JSON.stringify(r.promptFeedback) : ""} ${providerText.slice(0, 300)}`);
} else {
  const r = await api(`https://api.replicate.com/v1/models/${model}/predictions`, { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "wait" }, body: JSON.stringify(plan.body) });
  let pred = r;
  for (let t = 0; pred.status !== "succeeded"; t++) {
    if (["failed", "canceled"].includes(pred.status)) die(`replicate prediction ${pred.status}: ${pred.error ?? ""}`);
    if (t > 120) die("replicate prediction timed out");
    await new Promise((res) => setTimeout(res, 2000));
    pred = await api(`https://api.replicate.com/v1/predictions/${pred.id}`, { headers: { Authorization: `Bearer ${key}` } });
  }
  for (const url of [pred.output].flat().filter((u) => typeof u === "string" && /^https?:/.test(u))) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) die(`download failed ${res.status} for ${url}`);
    images.push({ buf: Buffer.from(await res.arrayBuffer()), mime: res.headers.get("content-type")?.split(";")[0] });
  }
}
if (!images.length) die("the provider returned no image data");

// ---------- save (never overwrite) ----------
const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };
function freePath(p) {
  if (!fs.existsSync(p)) return p;
  const e = path.extname(p), b = p.slice(0, -e.length);
  for (let v = 2; ; v++) { const c = `${b}-v${v}${e}`; if (!fs.existsSync(c)) return c; }
}
const settings = structuredClone(o.provider === "openai" ? plan.params : o.provider === "gemini" ? plan.body.generationConfig : plan.body.input);
delete settings.prompt;
const saved = [];
images.forEach((img, i) => {
  const actual = img.mime === "image/svg+xml" ? "svg" : rasterInfo(img.buf).format.replace("jpeg", "jpg");
  const ext = actual !== "unknown" ? actual : EXT[img.mime] ?? "bin";
  if (ext === "bin") console.warn(`generate-image: unrecognised image data (mime ${img.mime}); saved as .bin — inspect before use`);
  const requested = o.out.replace(/\.[^.\\/]+$/, "") + (images.length > 1 ? `-${i + 1}` : "") + `.${ext}`;
  if (path.extname(o.out).slice(1).toLowerCase().replace("jpeg", "jpg") !== ext) console.warn(`generate-image: provider returned ${ext}; saving with .${ext} (requested ${path.extname(o.out) || "no extension"})`);
  fs.mkdirSync(path.dirname(path.resolve(requested)), { recursive: true });
  const file = freePath(requested);
  fs.writeFileSync(file, img.buf);
  const info = ext === "svg" ? { format: "svg" } : rasterInfo(img.buf);
  const manifest = {
    file: path.basename(file), provider: o.provider, model, prompt: o.prompt, references: o.refs.map((r) => path.basename(r)),
    settings,
    providerResponse: plan.response, createdAt: new Date().toISOString(),
    notes: [o.provider === "gemini" ? "Gemini images carry a SynthID watermark." : null, "Check the provider's terms for commercial use."].filter(Boolean),
  };
  fs.writeFileSync(`${file}.asset.json`, JSON.stringify(manifest, null, 2));
  saved.push({ file, renamedFrom: file !== requested ? requested : undefined, bytes: img.buf.length, format: info.format, width: info.width, height: info.height, hasAlphaChannel: info.hasAlphaChannel, manifest: `${file}.asset.json` });
});

if (o.json) console.log(JSON.stringify({ provider: o.provider, model, saved, providerText: providerText || undefined }, null, 2));
else {
  for (const s of saved) {
    console.log(`SAVED ${s.file}  [${s.format}${s.width ? ` ${s.width}×${s.height}` : ""}, ${(s.bytes / 1024).toFixed(1)} KB${s.hasAlphaChannel !== undefined ? `, ${s.hasAlphaChannel ? "alpha channel" : "opaque"}` : ""}]`);
    if (s.renamedFrom) console.log(`      (${s.renamedFrom} existed — saved a versioned file)`);
    console.log(`      manifest: ${s.manifest}`);
  }
  if (providerText) console.log(`provider text: ${providerText.slice(0, 400)}`);
  if (o.transparent) console.log("next: node scripts/verify-asset.mjs <file> --expect-alpha   (confirms real transparency)");
}

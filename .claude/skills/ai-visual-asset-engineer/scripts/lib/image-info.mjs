// Shared, dependency-free image inspection used by verify-asset.mjs and convert-image.mjs.
import zlib from "node:zlib";

// ---------- format sniffing ----------
export function sniff(buf) {
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  if (buf.length >= 6 && buf.toString("ascii", 0, 3) === "GIF") return "gif";
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp" && /avi[fs]/.test(buf.toString("ascii", 8, 12))) return "avif";
  const head = buf.toString("utf8", 0, Math.min(buf.length, 2048)).replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return "svg";
  return "unknown";
}

// ---------- PNG ----------
export function readPng(buf) {
  const info = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  const bitDepth = buf[24], colorType = buf[25], interlace = buf[28];
  info.bitDepth = bitDepth;
  info.colorType = { 0: "gray", 2: "rgb", 3: "palette", 4: "gray+alpha", 6: "rgba" }[colorType] ?? `type${colorType}`;
  let off = 8, hasTRNS = false;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    if (type === "tRNS") hasTRNS = true;
    if (type === "IDAT") idat.push(buf.subarray(off + 8, off + 8 + len));
    if (type === "IEND") break;
    off += 12 + len;
  }
  info.hasAlphaChannel = colorType === 4 || colorType === 6 || hasTRNS;
  // Pixel-level transparency analysis for the common case (8-bit RGBA / gray+alpha, not interlaced).
  if ((colorType === 6 || colorType === 4) && bitDepth === 8 && interlace === 0) {
    try {
      const channels = colorType === 6 ? 4 : 2;
      const raw = zlib.inflateSync(Buffer.concat(idat));
      const stride = info.width * channels;
      const prev = Buffer.alloc(stride), cur = Buffer.alloc(stride);
      let transparent = 0, partial = 0, p = 0;
      const corners = [];
      for (let y = 0; y < info.height; y++) {
        const filter = raw[p++];
        for (let x = 0; x < stride; x++) {
          const a = x >= channels ? cur[x - channels] : 0, b = prev[x], c = x >= channels ? prev[x - channels] : 0;
          let v = raw[p++];
          if (filter === 1) v += a;
          else if (filter === 2) v += b;
          else if (filter === 3) v += (a + b) >> 1;
          else if (filter === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
          cur[x] = v & 0xff;
        }
        for (let x = channels - 1; x < stride; x += channels) {
          if (cur[x] === 0) transparent++;
          else if (cur[x] < 255) partial++;
        }
        if (y === 0 || y === info.height - 1) corners.push(cur[channels - 1], cur[stride - 1]);
        cur.copy(prev);
      }
      const total = info.width * info.height;
      info.transparentPixelRatio = +(transparent / total).toFixed(4);
      info.partialAlphaRatio = +(partial / total).toFixed(4);
      info.cornersTransparent = corners.every((a) => a === 0);
    } catch {
      /* analysis is best-effort; header info still valid */
    }
  }
  return info;
}

// ---------- WebP ----------
export function readWebp(buf) {
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const flags = buf[20];
    return {
      variant: "extended",
      width: 1 + buf.readUIntLE(24, 3),
      height: 1 + buf.readUIntLE(27, 3),
      hasAlphaChannel: (flags & 0x10) !== 0,
      animated: (flags & 0x02) !== 0,
    };
  }
  if (chunk === "VP8L") {
    const bits = buf.readUInt32LE(21);
    return { variant: "lossless", width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff), hasAlphaChannel: ((bits >> 28) & 1) === 1 };
  }
  if (chunk === "VP8 ") {
    return { variant: "lossy", width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, hasAlphaChannel: false };
  }
  return { variant: chunk };
}

// ---------- JPEG / GIF ----------
export function readJpeg(buf) {
  let off = 2;
  while (off < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7), hasAlphaChannel: false };
    }
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return { hasAlphaChannel: false };
}
export const readGif = (buf) => ({ width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) });

// ---------- SVG ----------
function checkXml(src) {
  const errors = [];
  const stack = [];
  let i = 0, root = null;
  const line = (pos) => src.slice(0, pos).split("\n").length;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    const text = src.slice(i, lt === -1 ? src.length : lt);
    for (const m of text.matchAll(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g)) errors.push(`line ${line(i + m.index)}: unescaped '&'`);
    if (lt === -1) break;
    if (src.startsWith("<!--", lt)) { const e = src.indexOf("-->", lt); if (e < 0) { errors.push(`line ${line(lt)}: unclosed comment`); break; } i = e + 3; continue; }
    if (src.startsWith("<![CDATA[", lt)) { const e = src.indexOf("]]>", lt); if (e < 0) { errors.push(`line ${line(lt)}: unclosed CDATA`); break; } i = e + 3; continue; }
    if (src.startsWith("<?", lt)) { const e = src.indexOf("?>", lt); if (e < 0) { errors.push(`line ${line(lt)}: unclosed processing instruction`); break; } i = e + 2; continue; }
    if (src.startsWith("<!", lt)) { const e = src.indexOf(">", lt); i = e < 0 ? src.length : e + 1; continue; }
    // find tag end, respecting quotes
    let j = lt + 1, quote = null;
    for (; j < src.length; j++) {
      const ch = src[j];
      if (quote) { if (ch === quote) quote = null; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === ">") break;
    }
    if (j >= src.length) { errors.push(`line ${line(lt)}: unclosed tag`); break; }
    const tag = src.slice(lt + 1, j);
    if (tag.startsWith("/")) {
      const name = tag.slice(1).trim();
      const open = stack.pop();
      if (open !== name) errors.push(`line ${line(lt)}: closing </${name}> does not match <${open ?? "nothing"}>`);
    } else {
      const selfClosing = tag.endsWith("/");
      const body = selfClosing ? tag.slice(0, -1) : tag;
      const name = body.match(/^[^\s/>]+/)?.[0];
      if (!name) { errors.push(`line ${line(lt)}: invalid tag`); }
      else {
        if (!root) root = { name, attrs: body };
        const rest = body.slice(name.length);
        const seen = new Set();
        const leftover = rest.replace(/\s+([^\s=/>]+)\s*=\s*("[^"]*"|'[^']*')/g, (_, attr) => {
          if (seen.has(attr)) errors.push(`line ${line(lt)}: duplicate attribute ${attr} on <${name}>`);
          seen.add(attr);
          return "";
        });
        if (leftover.trim()) errors.push(`line ${line(lt)}: malformed attributes on <${name}>: ${leftover.trim().slice(0, 40)}`);
        if (!selfClosing) stack.push(name);
      }
    }
    i = j + 1;
  }
  if (stack.length) errors.push(`unclosed element(s): ${stack.join(" > ")}`);
  return { errors, root };
}

export function checkSvg(src, { allowRaster = false } = {}) {
  const errors = [], warnings = [], info = {};
  const { errors: xmlErrors, root } = checkXml(src);
  errors.push(...xmlErrors);
  if (!root || root.name !== "svg") errors.push("root element is not <svg>");
  const rootAttrs = root?.attrs ?? "";
  const attr = (n) => rootAttrs.match(new RegExp(`\\s${n}\\s*=\\s*["']([^"']*)["']`))?.[1];
  if (!/xmlns\s*=\s*["']http:\/\/www\.w3\.org\/2000\/svg["']/.test(rootAttrs)) errors.push('root <svg> lacks xmlns="http://www.w3.org/2000/svg" (required for standalone .svg files and <img> usage)');
  info.viewBox = attr("viewBox") ?? null;
  info.width = attr("width") ?? null;
  info.height = attr("height") ?? null;
  if (!info.viewBox) errors.push("missing viewBox (needed for scaling)");
  else if (!/^\s*-?[\d.]+[\s,]+-?[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+\s*$/.test(info.viewBox)) errors.push(`invalid viewBox "${info.viewBox}"`);
  const hidden = /aria-hidden\s*=\s*["']true["']/.test(rootAttrs);
  const named = /<title[\s>]/.test(src) || /\saria-label\s*=/.test(rootAttrs) || /\saria-labelledby\s*=/.test(rootAttrs);
  info.accessibleName = named; info.decorative = hidden;
  if (!named && !hidden) warnings.push('no <title>/aria-label and not aria-hidden="true": add a title for meaningful graphics or mark decorative ones hidden');
  const ids = [...src.matchAll(/\sid\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
  const dup = ids.filter((id, k) => ids.indexOf(id) !== k);
  if (dup.length) errors.push(`duplicate id(s): ${[...new Set(dup)].join(", ")}`);
  const refs = [...src.matchAll(/url\(#([^)]+)\)|href\s*=\s*["']#([^"']+)["']/g)].map((m) => m[1] ?? m[2]);
  const missing = [...new Set(refs.filter((r) => !ids.includes(r)))];
  if (missing.length) errors.push(`references to undefined id(s): ${missing.join(", ")}`);
  const rasterImages = [...src.matchAll(/<image\b[^>]*?(?:xlink:)?href\s*=\s*["']([^"']+)["']/g)].map((m) => m[1]);
  info.embeddedRasters = rasterImages.length;
  if (rasterImages.length) {
    const msg = `contains ${rasterImages.length} <image> element(s) (${rasterImages.map((h) => (h.startsWith("data:") ? h.slice(0, 22) + "…" : h)).join(", ")}): not a true vector asset`;
    allowRaster ? warnings.push(msg) : errors.push(msg);
  }
  if (/<script[\s>]/i.test(src)) warnings.push("contains <script>: scripts do not run when the SVG is used via <img>/CSS, and are a security risk for user-facing uploads");
  if (/\son[a-z]+\s*=/i.test(src)) warnings.push("inline event handler attributes (on*=) found");
  if (/<foreignObject[\s>]/.test(src)) warnings.push("contains <foreignObject>: inconsistent rendering outside browsers");
  if (/(?:href|src)\s*=\s*["']https?:/i.test(src) || /@import/.test(src)) warnings.push("external references found: blocked when the SVG is used via <img>; inline or remove them");
  const longNums = (src.match(/\d+\.\d{4,}/g) || []).length;
  if (longNums > 20) warnings.push(`${longNums} numbers with 4+ decimals: run SVGO to reduce size`);
  info.elements = (src.match(/<[a-zA-Z][^\s/>]*/g) || []).length;
  info.animated = /<animate|<animateTransform|<animateMotion|<set[\s>]|@keyframes|animation\s*:/.test(src);
  if (info.animated && !/prefers-reduced-motion/.test(src)) warnings.push("animated SVG without a prefers-reduced-motion rule");
  return { errors, warnings, info };
}

// ---------- AVIF (ISOBMFF): first 'ispe' box = primary image size; alpha = auxiliary alpha item ----------
export function readAvif(buf) {
  const ispe = buf.indexOf("ispe");
  const info = ispe > 0 ? { width: buf.readUInt32BE(ispe + 8), height: buf.readUInt32BE(ispe + 12) } : {};
  info.hasAlphaChannel = buf.indexOf("urn:mpeg:mpegB:cicp:systems:auxiliary:alpha") !== -1 || buf.indexOf("urn:mpeg:hevc:2015:auxid:1") !== -1;
  return info;
}

/** Header-level info for any supported raster buffer. */
export function rasterInfo(buf) {
  const format = sniff(buf);
  const read = { png: readPng, webp: readWebp, jpeg: readJpeg, gif: readGif, avif: readAvif }[format];
  return { format, ...(read ? read(buf) : {}) };
}

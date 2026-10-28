# Prompt Templates

Fill-in templates for raster generators (realistic images, illustrations, transparent assets, textures, sprites, edits) and specifications you author against yourself when writing SVG. Replace `{slots}` with concrete values, and delete lines that don't apply. Notes on specific providers are in [image-generation-integrations.md](image-generation-integrations.md).

## Contents

1. Prompt rules that apply everywhere
2. Realistic photograph / product shot
3. Raster illustration
4. Transparent asset / cutout
5. Seamless texture
6. Sprite / game asset sheet
7. Image editing with reference images
8. Consistent variant sets
9. SVG illustration spec (for writing SVG code)
10. Icon set spec (SVG)
11. Animated SVG spec
12. Recording prompts

---

## 1. Prompt rules that apply everywhere

- **Describe the image, not the task.** Write "A ceramic coffee mug on a walnut desk, morning window light from the left", not "make an image for my hero".
- **State its use.** Purpose, placement and aspect ratio decide composition: "hero banner, 16:9, empty space on the right third for a headline".
- **Be concrete.** Name materials, lighting direction, lens, time of day, palette (hex values when the brand has them) and mood.
- **Use positive phrasing.** Generators handle "plain seamless light-grey background" better than "no clutter". Keep exclusions to a short list at the end.
- **Don't rely on generated text.** Logos, UI copy and long text come out garbled. Leave space and add text in HTML or SVG instead. Request short text only from a model known to render it well.
- **Keep protected IP out.** No brand logos, trademarks, real people's likenesses or named artists' styles unless the user owns the rights or has permission.
- **Iterate one change at a time.** Keep everything else in the prompt fixed so you can tell what each change did.
- **Use the model's size options.** Ask for the nearest supported size or aspect ratio, then resize or crop locally. Don't ask for arbitrary pixel sizes the API can't produce.

## 2. Realistic photograph / product shot

```text
Photorealistic {shot type: product photo | lifestyle photo | editorial portrait | architectural photo} of {subject with materials, colours, condition}.
Setting: {environment, surface, props — max 3}.
Composition: {framing: close-up | medium | wide}, {camera angle: eye level | 3/4 top-down | low angle}, subject {position}, {negative space: e.g. clear area on the left third for headline text}.
Lighting: {key light type and direction, e.g. soft window light from upper left}, {fill / rim}, {time of day}.
Camera: {focal length, e.g. 85mm}, {aperture/depth of field, e.g. f/2.8 shallow depth, background softly blurred}.
Colour palette: {dominant colours, brand hex values}. Mood: {calm | energetic | premium | clinical}.
Output: {aspect ratio}, high detail, natural skin/material textures, no text, no watermark, no logos.
```

Example:

```text
Photorealistic product photo of a matte sage-green ceramic pour-over coffee dripper on a light oak counter.
Setting: a glass carafe and a small linen towel, out of focus behind.
Composition: medium close-up, 3/4 angle slightly above, dripper on the right third, clear soft background on the left half for headline text.
Lighting: soft diffused morning window light from the left, gentle rim light on the dripper edge.
Camera: 85mm, f/2.8, shallow depth of field.
Colour palette: sage #9CAF88, warm oak, off-white #F5F1EA. Mood: calm, premium.
Output: 16:9, no text, no watermark, no logos.
```

## 3. Raster illustration

```text
{Style: flat vector-style illustration | soft 3D clay render | isometric illustration | hand-drawn ink and watercolour | editorial collage} of {scene/subject}.
Characters: {count, poses, diversity notes — generic people, no real likenesses}.
Composition: {layout}, {focal point}, {space reserved for UI/text}.
Style details: {line weight, shading: none | soft gradients | cel}, {texture: grain | none}, {level of detail}.
Palette: limited to {3–6 hex colours}; background {colour}.
Output: {aspect}, consistent stroke and shading, no text, no watermark.
```

If the user wants an editable vector illustration, use the SVG spec (§9) instead of a raster model. A raster "vector style" image is still a raster.

## 4. Transparent asset / cutout

Use this only with a provider that outputs real transparency (see the integrations guide). Otherwise generate on a flat background and remove it (see the conversion workflow).

```text
{Subject} as an isolated cutout, {view: front | 3/4 | side}, centered with {10%} padding on all sides.
Style: {photoreal | illustration style}. Lighting: {soft studio light}, consistent with {target page: light | dark} backgrounds.
Background: fully transparent.            ← providers with transparency support (also set the API parameter)
Background: solid flat #00FF00, no shadow, no gradient, no floor.  ← for later background removal
Edges: clean, no halo, no drop shadow (shadows added later in CSS), no text.
```

- Choose a chroma colour that doesn't appear in the subject: green for most subjects, magenta for green subjects.
- After generation, run `verify-asset.mjs --expect-alpha`. It fails when transparency is fake, for example a checkerboard pattern painted into the image.

## 5. Seamless texture

```text
Seamless tileable texture of {material: brushed aluminium | linen fabric | terrazzo | paper grain | concrete}.
View: flat, straight-on, orthographic, no perspective, no vignette.
Lighting: completely even, no directional shadows or highlights (lighting is added in the 3D/CSS layer).
Detail scale: {fine | medium}; features repeat at about {N} per tile; no obvious unique landmarks.
Colour: {base hex}, subtle variation only. Output: square {1024×1024}.
```

Check tiling by rendering a 2×2 grid of the texture (render-preview or an HTML page with `background-repeat`) and looking for seams. For PBR use (normal, roughness and AO maps), note that general image models don't produce physically correct maps. Say so, and derive maps with dedicated tools if they're needed.

## 6. Sprite / game asset sheet

```text
Sprite sheet of {character/object} in {style: 16-bit pixel art | flat cartoon}, {N} frames of {animation: walk cycle | idle | explosion}.
Layout: frames in a single horizontal row, equal cell size, same scale and baseline in every frame, {N}px gutter.
Background: {transparent | flat #FF00FF for removal}. Consistent palette: {hex list}. No text, no frame numbers.
```

Models often break the grid. Verify the cell alignment, or generate frames one at a time with a shared reference image and assemble the sheet locally.

## 7. Image editing with reference images

Edits work best when you state exactly what stays the same.

```text
Using the provided image{s}: {image 1 = product photo, image 2 = style reference}.
Keep unchanged: {subject identity, shape, logo placement, colours, framing, camera angle}.
Change only: {background → soft gradient #F5F1EA to white | lighting → golden hour | add {object} on the left}.
Match: {lighting direction and colour temperature of image 2}.
Output: same aspect ratio as image 1, photoreal, no added text.
```

For a masked edit (inpainting): describe only the masked region's new content. The mask's transparent area marks where to edit, and the mask must match the input image's dimensions.

## 8. Consistent variant sets

To keep a set (heroes for several pages, avatars, theme variants) consistent:

1. Write one **style block** and reuse it word for word: style, palette, lighting, lens, background, mood.
2. Vary only the **subject line** between generations.
3. Where the provider supports reference images, pass the first approved image as the style reference for the rest.
4. Record all prompts in the manifest (§12).

Theme variants (light/dark) of a raster are usually better as one generation plus CSS or overlay treatment than as two separate generations.

## 9. SVG illustration spec (for writing SVG code)

When writing SVG yourself, fill this in first, then follow [svg-authoring.md](svg-authoring.md).

```text
Asset: {name}  Purpose: {hero decoration | empty-state illustration | diagram | logo mark}
Canvas: viewBox 0 0 {W} {H}; renders at {CSS size}; must scale cleanly from {min} to {max} px.
Composition: {elements and their arrangement}; focal point {x,y}; safe padding {px}.
Style: {flat | line | duotone | geometric}; stroke {width}px, {round|square} caps; corner radius {r}.
Palette: {hex list} — map to CSS custom properties {--illus-primary, …} if theming is needed.
Detail budget: ≤ {N} paths / {KB} after SVGO.
Accessibility: meaningful → <title>{text}</title> + role="img"; decorative → aria-hidden="true".
Animation: none | {see §11}.
```

## 10. Icon set spec (SVG)

```text
Set: {names}. Grid: 24×24 viewBox, 2px safe padding (live area 20×20).
Style: {outline | solid | duotone}; stroke-width 2 (or 1.5); stroke-linecap round; stroke-linejoin round.
Colour: stroke="currentColor" / fill="none" (outline) or fill="currentColor" (solid); no hard-coded colours.
Geometry: align to whole/half pixels; consistent optical size (circles slightly larger than squares).
Consistency with existing set: {lucide | phosphor | in-house} — match its stroke and corner style.
Output: one SVG per icon, no <title> in the file (the React component adds the label), no ids, no transforms.
```

## 11. Animated SVG spec

```text
Animation: {what moves} — purpose {feedback | loading | attention | delight}.
Technique: CSS @keyframes on SVG elements (default) | SMIL (self-contained file used via <img>) | JS (Motion/GSAP, inline SVG only).
Timing: duration {ms}, easing {curve}, iterations {1 | infinite}, delay/stagger {ms}.
Transform origin: {per element, e.g. transform-box: fill-box; transform-origin: center}.
Reduced motion: {static final frame | slower fade}; loops > 5 s need a pause control on the page.
Delivery: inline React component | standalone .svg via <img> (CSS/SMIL only, no JS).
```

## 12. Recording prompts

Save every generated asset's prompt and settings next to it, so the asset can be reproduced or refined:

```jsonc
// public/assets/hero-coffee.asset.json  (or one assets-manifest.json per directory)
{
  "file": "hero-coffee-v1.png",
  "derivatives": ["hero-coffee-640w.webp", "hero-coffee-1280w.webp", "hero-coffee-1920w.webp"],
  "provider": "openai", "model": "<exact model id used>", "size": "1536x1024", "quality": "high",
  "prompt": "<full prompt>", "references": ["product-raw.jpg"],
  "createdAt": "<ISO date>", "licenceNotes": "Generated; check the provider's terms for commercial use"
}
```

`generate-image.mjs` writes this sidecar automatically. Ask before committing manifests if the project doesn't want them.

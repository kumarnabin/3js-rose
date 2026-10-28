# Design Inspiration and Reference Analysis

How to study reference websites, extract transferable principles, and use Recreate mode responsibly. Galleries show *what* is possible; they are never the authority on *how* to implement it — that comes from official library documentation.

## Contents

1. Source types and how much to trust them
2. Reference study workflow
3. Extraction framework (what to write down)
4. Recreate mode: rules
5. Turning observations into tokens and a motion spec
6. Avoiding template-looking output
7. Patterns by product type

---

## 1. Source types and how much to trust them

| Source type | Examples | Use for | Do not use for |
|---|---|---|---|
| Award / curated galleries | Awwwards, Godly (now redirects to recent.design), SiteInspire, Httpster, Minimal Gallery, Land-book, Lapa Ninja | Visual direction, layout ideas, interaction ideas | API details, performance or accessibility claims |
| Tutorials with demos | Codrops (tympanus.net/codrops) | Technique breakdowns, shader and WebGL ideas | Production architecture without review; check each demo's licence |
| Code playgrounds | CodePen, Shadertoy | Isolated techniques | Copying code without checking the pen's licence |
| Component registries | Magic UI, Aceternity UI, React Bits, Animate UI, Motion Primitives, Animata, 21st.dev, Hover.dev, Uiverse | Ready-made animated components to adapt | Assuming accessibility, performance or licence |
| Discovery directories | Designeer, Taste (11xui), Shinozaki Design browse, BoringUI inspiration, JS Library Gallery, UINice motion | Finding more resources | Treating listed tools as vetted |
| Official documentation | motion.dev, gsap.com/docs, r3f.docs.pmnd.rs, threejs.org/docs, ui.shadcn.com | APIs, install, versions, patterns | — this is the authority |

## 2. Reference study workflow

1. **Collect 3–6 references** relevant to the product type, not just visually striking ones. A dev-tools site and a fashion brand need different references.
2. **Open each live** (browser tool if available). Screenshots miss motion, timing and responsive behaviour. Check desktop and mobile widths.
3. **Interact deliberately**: hover, focus with keyboard, scroll slowly and fast, resize, toggle reduced motion, navigate between pages.
4. **Record observations** using the framework below — facts, not adjectives.
5. **Inspect implementation hints** only to learn technique (DevTools → Elements/Animations panel, network for libraries used). Do not copy their source.
6. **Synthesise**: what 3–5 principles recur across the references? Which suit *this* product?
7. **Decide** what to adopt, adapt or reject, and say why in the design notes.

If browsing is unavailable, state it, and base decisions on known patterns without claiming the sites were checked.

## 3. Extraction framework

Write down, per reference:

```
Reference: <url>  (checked live: yes/no, date, viewport sizes)
Layout:      grid columns, max content width, section rhythm, asymmetry, density
Hierarchy:   what is seen 1st/2nd/3rd; how size, weight, colour and space create it
Typography:  families (classify: grotesk/serif/mono), scale ratio, line-length, tracking on headings
Spacing:     base unit, section padding at desktop/mobile, consistency
Colour:      background/surface/text/accent count, contrast, light/dark handling
Depth:       borders vs shadows vs layered surfaces, blur, 3D
Motion:      triggers (load/scroll/hover/click), properties, approx durations, easing feel,
             stagger, scroll-linked vs scroll-triggered, pinning, exit behaviour
Interaction: hover affordances, cursor effects, focus styles, feedback speed
Responsive:  what changes at mobile — reflow, hidden effects, simplified motion
Reduced motion & a11y: what happens with reduce on; keyboard path; contrast issues
Performance feel: jank, load time, heavy assets
Transferable principles: 2–4 bullet points
Not transferable: brand-specific elements, things that would hurt this product
```

## 4. Recreate mode: rules

Recreate the *observable layout, styling approach and interaction patterns* with original code.

Allowed:

- Matching layout structure, grid, spacing rhythm, interaction mechanics and motion timing.
- Using similar *categories* of fonts (e.g. a geometric grotesk) chosen from properly licensed sources.
- Rebuilding effects from scratch with documented libraries.

Not allowed:

- Copying logos, brand names, trademarks, product imagery, illustrations, photos, 3D models, videos, icons, copywriting, or proprietary fonts.
- Copying their HTML/CSS/JS bundle, shaders or Lottie/Rive files.
- Producing something that could be mistaken for the original brand (no impersonation).

Replace all content with the user's own or clearly marked placeholders, and list substitutions in the report.

## 5. Turning observations into tokens and a motion spec

- Typography: pick a scale ratio (1.2 for dense UI, 1.25–1.333 for marketing) and derive sizes; set line-height per size.
- Spacing: one base (4 px) and a short set of steps actually used.
- Colour: neutral ramp + one accent (+ semantic success/warning/danger). Define in CSS variables with light and dark values.
- Motion: map observed timings onto the token set (`fast`, `base`, `emphasized`) instead of copying exact numbers. Fill in [../templates/animation-specification.md](../templates/animation-specification.md).

## 6. Avoiding template-looking output

Before finalising, check:

- Does the hero say something specific to this product, with a real visual (product UI, data, photo), or is it a gradient + generic headline?
- Is there one clear typographic voice, or default system font plus random weights?
- Are sections varied in rhythm (full-bleed, narrow text, dense grid) or identical centred stacks?
- Is the accent colour used for meaning (CTA, selection) or sprinkled everywhere?
- Is any motion present only because the library made it easy?
- Are shadows, radii and borders consistent and restrained?

## 7. Patterns by product type

| Product | Prioritise | Motion character |
|---|---|---|
| Enterprise dashboard / admin | Density, scanability, predictable nav, fast feedback, accessible charts | Minimal: 100–200 ms state transitions, no entrance choreography on data |
| SaaS marketing site | Clear value prop, product screenshots, social proof, conversion path | One hero moment, restrained scroll reveals, interactive product demos |
| Portfolio / agency | Personality, craft, case-study storytelling | Expressive, but skippable; strong typography; page transitions |
| E-commerce / product | Product imagery, trust, speed, filtering | Subtle; image zoom, cart feedback; never slow checkout |
| Docs / dev tools | Readability, search, code blocks, navigation | Almost none beyond feedback |
| Editorial / storytelling | Reading flow, pacing | Scroll-driven sequences with reduced-motion fallback |

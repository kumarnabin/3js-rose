# React Component Libraries

How to use shadcn/ui and Radix as a foundation, and how to adopt components from animated copy-paste registries safely. Licence and status details for each source are in [resource-catalog.md](resource-catalog.md).

## Contents

1. Foundation: shadcn/ui + Radix
2. Animated registries: what each is good for
3. Adoption workflow for copy-paste components
4. Adapting a registry component to the project
5. Red flags
6. Vue requests

---

## 1. Foundation: shadcn/ui + Radix

- shadcn/ui is **not a dependency**: its CLI copies component source into the project (default `src/components/ui/`), so you own and edit the code. Components are built on Radix primitives (accessibility, focus management, keyboard support) and styled with Tailwind.
- Commands (check current docs at https://ui.shadcn.com/docs/cli first):

  ```bash
  npx shadcn@latest init           # once; writes components.json, utils, CSS variables
  npx shadcn@latest add button dialog tabs
  npx shadcn@latest add <registry-url-or-namespace/item>   # third-party registries that support the shadcn registry format
  ```

- Before running `init` in an existing project, check whether `components.json` already exists; never re-init over a customised setup.
- shadcn's components animate open/close with CSS keyframe classes keyed off Radix `data-state` attributes. Tweak those classes before reaching for Motion.
- shadcn/ui now also offers Base UI (`@base-ui/react`) variants alongside Radix. Check which primitive library the project's `components.json` and existing components use, and stay with it. Don't mix the two for the same component type.
- Radix can also be used directly, without shadcn, for headless primitives. Match the import style the project already uses (scoped `@radix-ui/react-*` packages, or the unified `radix-ui` package).
- Theming: shadcn uses CSS variables (`--background`, `--foreground`, `--primary`, …). Put brand tokens there instead of hard-coding colours in components.

## 2. Animated registries: what each is good for

| Source | Strength | Typical stack | Watch out for |
|---|---|---|---|
| Magic UI (magicui.design) | Marketing-page effects: marquees, animated beams, number tickers, bento grids, shimmer buttons | React, TS, Tailwind, Motion; shadcn-registry install | Effects stacked together look templated; perpetual animations need pause/reduced-motion handling |
| Aceternity UI (ui.aceternity.com) | Showy hero/section effects: spotlights, 3D cards, parallax, background beams | React, Tailwind, Motion | Heavy visuals, GPU cost, accessibility gaps; use one at most per page |
| React Bits (reactbits.dev) | Text animations, backgrounds, cursor effects, some WebGL components | Variants in JS/TS and CSS/Tailwind | Some components pull in three.js/ogl/gsap; check deps and licence terms |
| Animate UI (animate-ui.com) | Animated versions of familiar primitives (tabs, dialogs, accordions) | React, TS, Tailwind, Motion, Radix-style APIs | Verify accessibility parity with the Radix originals |
| Motion Primitives (motion-primitives.com) | Small, composable motion components (text effects, morphing dialogs, carousels) | React, Tailwind, Motion | Check Motion version compatibility |
| Animata (animata.design) | Hand-crafted interaction and animation snippets | React, Tailwind, Motion | Snippet-level quality varies; review each |
| 21st.dev | Community marketplace of shadcn-style components and blocks | Mixed | Every component is authored by someone different: licence, quality and deps vary per item |
| Hover.dev | Animated UI components and templates | React, Tailwind, Motion | Free vs paid split; check which you are using |
| Uiverse (uiverse.io) | Community HTML/CSS UI elements (buttons, loaders, toggles) | Plain HTML/CSS (some Tailwind) | Must be converted to React and made accessible; quality varies |

## 3. Adoption workflow for copy-paste components

```
- [ ] Need: which product problem does this component solve? (If none, don't add it.)
- [ ] Licence: read the source's licence page; record it (catalog has last-known status)
- [ ] Read the full source before adding it
- [ ] Dependencies: list what it imports; reject if it adds a second animation library for one effect
- [ ] Versions: does it target the Motion / Tailwind / React versions installed here?
- [ ] Accessibility: semantics, keyboard, focus, ARIA, reduced motion
- [ ] Performance: per-frame state? huge DOM? blur/backdrop on large areas? canvas/WebGL?
- [ ] Integrate: move into components/, replace colours with project tokens, motion values with motion tokens
- [ ] Verify: render in browser, reduced motion, mobile, keyboard
```

## 4. Adapting a registry component to the project

- Replace imports: `framer-motion` → whatever the project uses (or vice versa). Do not install a second copy of the same library under another name.
- Replace hard-coded colours (`bg-neutral-950`, hex values) with semantic tokens (`bg-background`, `text-muted-foreground`, `var(--primary)`).
- Replace magic durations/easings with motion tokens.
- Add `useReducedMotion()` or rely on `MotionConfig reducedMotion="user"`; stop infinite loops when reduced or offscreen.
- Add missing semantics: buttons as `<button>`, decorative layers `aria-hidden`, text split into spans keeps an accessible label.
- Remove props and variants the project will not use.
- Keep attribution comments where the licence requires them.

## 5. Red flags

- "Just paste this" components with no licence stated → ask the user or skip.
- Components that hijack scroll, hide the native cursor, or block interaction until an animation finishes.
- `useState` updated on `mousemove`/`scroll` to drive styles.
- Absolute-positioned decorative layers that capture pointer events (missing `pointer-events-none`).
- Text rendered only in canvas/SVG with no DOM equivalent.
- Effects that only look right at one viewport size.

## 6. Vue requests

React is the default. Use Vue-specific resources (e.g. Inspira UI, Vue Bits, `motion-v`, `@vueuse/motion`) only when the user explicitly asks for Vue. Verify each before recommending; they are not part of the default catalog.

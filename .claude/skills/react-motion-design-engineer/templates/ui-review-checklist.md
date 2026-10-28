# Template: UI Review Checklist

Use for Audit mode and as a self-review before reporting work as done. Mark each item ✅ pass, ⚠️ issue, ❌ fail, or — not applicable / not checked (say which). Only mark ✅ for things actually inspected.

## Report header

```
Scope:        <pages / components reviewed>
Method:       <code read | browser (desktop + mobile) | Lighthouse | Playwright | Profiler>
Not checked:  <and why>
```

## 1. Visual hierarchy and layout

- [ ] One obvious primary action per view
- [ ] Clear reading order: heading → supporting text → action
- [ ] Consistent grid, max-widths and alignment edges
- [ ] Spacing uses a consistent scale; section rhythm is intentional
- [ ] Density appropriate to product type (dashboards dense, marketing airy)
- [ ] No card-in-card nesting, stacked borders or shadow soup

## 2. Typography

- [ ] ≤ 2 families (+ mono); weights used purposefully
- [ ] Defined type scale; no arbitrary one-off sizes
- [ ] Body 16 px+ on marketing, line length ≤ ~75ch
- [ ] Headings balanced; no orphans on key lines
- [ ] Tabular numbers in tables and metrics

## 3. Colour and surfaces

- [ ] Neutral ramp + one accent; semantic colours for status only
- [ ] Contrast AA for text and UI components in every state and theme
- [ ] Dark mode (if present) is designed, not inverted
- [ ] Gradients, blur and glass used sparingly and with reason

## 4. Components and states

- [ ] Hover, focus-visible, active, disabled for all interactive elements
- [ ] Loading, empty, error and success states exist and are real (no fake spinners)
- [ ] Forms: labels, help text, inline validation, error recovery
- [ ] Buttons that look clickable all do something

## 5. Motion

- [ ] Each animation has a purpose (feedback, hierarchy, continuity, orientation, narrative)
- [ ] Values come from motion tokens; durations consistent
- [ ] Routine interactions ≤ 250 ms; nothing blocks the user
- [ ] Exit animations shorter than entrances
- [ ] Interrupting (fast clicks, scroll, navigation) does not glitch
- [ ] No two systems animating the same property
- [ ] No perpetual motion competing with content; loops > 5 s have pause control
- [ ] Reduced motion: verified, meaningful alternative, no lost information

## 6. Accessibility

- [ ] Semantic landmarks (`header`, `nav`, `main`, `footer`) and heading levels
- [ ] Full keyboard path; visible focus; no traps; skip link on long pages
- [ ] Dialogs/menus use accessible primitives; focus returns on close
- [ ] Images have `alt`; decorative media `aria-hidden`
- [ ] Live regions for async status
- [ ] Touch targets ≥ 24 px (44 px preferred on mobile)
- [ ] 3D / canvas has text or control alternatives

## 7. Responsive

- [ ] 375, 768, 1024, 1440 px checked
- [ ] No horizontal scroll; tap targets reachable; sticky elements don't cover content
- [ ] Heavy effects simplified or disabled on small/low-power devices

## 8. Performance

- [ ] LCP element visible without waiting for animation
- [ ] No CLS from fonts, images or lazy content
- [ ] Heavy modules code-split (3D, Lottie/Rive, GSAP plugins)
- [ ] No per-frame React state; Profiler shows no animation-driven re-renders
- [ ] Images/models compressed and sized appropriately
- [ ] Smooth at 4× CPU throttle on key interactions

## 9. Code quality

- [ ] Follows project conventions; no unrelated rewrites
- [ ] Typed props with sensible defaults; no `any` leaks
- [ ] Primitives separated from page choreography
- [ ] No unused dependencies added; each new dependency justified
- [ ] Typecheck, lint, build and tests pass (state which were run)

## Findings format

```
[severity: critical | high | medium | low] <area> — <file:line or page/selector>
Problem:   <observable issue>
Impact:    <who is affected and how>
Fix:       <specific change>
```

Order findings by severity, then by effort (quick wins first within a severity).

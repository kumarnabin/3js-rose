# Example: Improving an Existing SaaS Dashboard (Enhance + Animate modes)

## Request

> "Our admin dashboard feels clunky and dated. Make it look modern and add some animation. Don't break anything."

## A. Understand — inspect before touching anything

Commands run first:

```bash
cat package.json
ls src src/components src/pages
grep -rn "framer-motion\|from \"motion\|gsap\|react-spring" src | head
```

Findings (example):

- React 18.3, Vite 5, Tailwind v3 with a custom `tailwind.config.js`, React Router v6, TanStack Query, shadcn/ui components already in `src/components/ui`.
- `framer-motion` v10 already installed and used in two places (sidebar collapse, toast). → **Keep using it.** Do not add `motion` alongside it or migrate unless asked; note the migration path (`framer-motion` → `motion`, imports from `motion/react`) as a follow-up.
- Pain points observed in browser: inconsistent spacing (12/14/18/20 px mixed), five greys, table rows jump when data refetches, no loading skeletons (blank then pop), modals appear instantly with no focus ring on close button, sidebar collapse animates `width` causing table reflow jank.

Users: internal ops staff, 6–8 h/day in the tool, mostly desktop, keyboard-heavy. → **Density and speed beat spectacle.**

## C. Design decisions

- Tokens: consolidate spacing to a 4 px scale; greys to the shadcn neutral ramp via existing CSS variables; one accent (existing brand blue) for primary actions and selection only.
- Type: keep the existing font; enforce scale (12/13/14/16/20/24); `tabular-nums` in tables and KPI tiles.
- Motion budget (all ≤ 200 ms, no entrance choreography on data):

| Element | Change | Purpose |
|---|---|---|
| Table refetch | keep previous data visible (`placeholderData: keepPreviousData`) + subtle row highlight on changed cells (bg fade 600 ms) | continuity, no jump |
| Loading | skeletons matching final layout | perceived performance, no CLS |
| Sidebar collapse | animate `transform`/opacity of labels; width snaps via CSS grid track change with `layout` on the nav only | remove reflow jank |
| Dialogs | use existing shadcn `Dialog` CSS animations (already present but overridden) | feedback |
| Tabs | `layoutId` underline | orientation |
| Toasts | unchanged (already fine) | — |

Rejected: animated KPI counters on every refresh (distracting for staff watching numbers), page transitions (slows a tool used all day), glass cards.

## D. Implementation highlights

- Changes scoped to: `tailwind.config.js` (spacing/colour cleanup), `src/components/ui/table.tsx` (row highlight), `src/components/layout/sidebar.tsx`, `src/components/ui/skeleton.tsx` usage in 4 pages, `src/components/ui/tabs.tsx`.
- Changed-cell highlight without re-render storms:

```tsx
// highlight a cell when its value changes; pure CSS animation, keyed by value
<td key={String(row.status)} className="animate-[cell-flash_600ms_ease-out] motion-reduce:animate-none">
  {row.status}
</td>
```

```js
// tailwind.config.js (v3) — extend
keyframes: { "cell-flash": { from: { backgroundColor: "hsl(var(--accent))" }, to: { backgroundColor: "transparent" } } },
```

- Sidebar: replaced `animate={{ width }}` with a CSS grid column change plus `motion.span` label fades, so the main table no longer re-lays out every frame.

## E. Verification

- `npm run typecheck`, `npm run lint`, `npm test` (existing 84 tests) → all pass; no tests needed changing because behaviour is unchanged.
- Browser: walked through the 5 main pages at 1440 and 1024 px; keyboard through filters → table → row actions → dialog → close (focus returns to trigger).
- Reduced motion emulated: highlight and sidebar label fades disabled; skeletons static.
- React Profiler: sidebar collapse no longer re-renders the table.

## Report (shape)

- Files: list each with one-line change summary.
- Decisions: kept `framer-motion` (already installed); no new dependencies.
- Open issues: suggest migrating `framer-motion` → `motion` in a separate PR; charts lack accessible data tables (out of scope, flagged).

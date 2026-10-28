# Template: Project Implementation Plan

Use for multi-step builds or redesigns where the user should approve direction before code is written. Keep it short enough to read in two minutes; detail lives in the motion spec and code.

```markdown
# <Project / feature name> — Implementation Plan

## 1. Goal
<One paragraph: who it is for, what they need to do, what success looks like.>

## 2. Mode and starting point
Mode: Build | Enhance | Recreate | Animate
Starting point: new project | existing repo at <path> (React <ver>, Vite <ver>, Tailwind <ver>, router, UI lib, motion libs)
Reference sites (inspiration only): <urls> — checked live: yes/no

## 3. Constraints
- Browsers / devices:
- Accessibility target: WCAG 2.2 AA (+ reduced motion)
- Performance budget: e.g. LCP < 2.5 s on mid-range mobile, JS < 200 KB gz initial
- Brand / content constraints:
- Must not change: <existing features, APIs, routes>

## 4. Design direction
- Layout & hierarchy:
- Typography (families + scale):
- Colour (neutrals + accent, light/dark):
- Surfaces & depth:
- Motion character & budget:
- 3D (if any) and fallback:

## 5. Dependencies
| Package | Why needed | Already installed? |
|---|---|---|
| motion | entrance, layout, gestures | no |
| … | … | … |
Rejected options: <library — reason>

## 6. Work breakdown
| # | Step | Files | Verification |
|---|---|---|---|
| 1 | Tokens + providers | lib/motion-tokens.ts, app/providers.tsx | typecheck |
| 2 | Layout shell + nav | app/layouts/… | browser desktop/mobile |
| 3 | Sections / components | … | … |
| 4 | Motion pass | … | reduced-motion check |
| 5 | 3D scene (lazy) | components/three/… | WebGL fallback test |
| 6 | QA pass | — | build, tests, Playwright, Lighthouse |

## 7. Risks and open questions
- <risk> → <mitigation>
- <question for the user, only if it changes the implementation>

## 8. Definition of done
- [ ] Builds and typechecks
- [ ] Tests pass (list)
- [ ] Verified in browser: desktop + 375 px, keyboard, reduced motion, no console errors
- [ ] Review checklist completed (templates/ui-review-checklist.md)
- [ ] Report lists files, decisions, commands and remaining issues
```

# Template: React Project Structure

Use for new projects (Build mode). For existing projects, follow their structure instead and only add the folders you need.

## Scaffold

Verify current commands against official docs before running (Vite: https://vite.dev/guide/, Tailwind: https://tailwindcss.com/docs/installation/using-vite, shadcn/ui: https://ui.shadcn.com/docs/installation/vite).

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
npm install tailwindcss @tailwindcss/vite
# configure the @ alias in tsconfig.json, tsconfig.app.json and vite.config.ts (see shadcn Vite guide).
# TypeScript 7 removed `baseUrl`: write `"paths": { "@/*": ["./src/*"] }` with a leading ./ and no baseUrl
npx shadcn@latest init
npm install motion lucide-react
# add only when a feature needs it:
#   npm install gsap @gsap/react                     # timelines, pinning, scroll choreography
#   npm install three @react-three/fiber @react-three/drei   # 3D; add @types/three as dev dep
#   npm install lenis                                # smooth scroll, with justification
npm install -D vitest @testing-library/react @testing-library/dom @testing-library/jest-dom @testing-library/user-event jsdom
npm init playwright@latest   # if browser E2E is wanted
```

## Directory layout

```text
src/
├── app/                      # app shell: providers, router, layouts
│   ├── providers.tsx         # MotionPreferenceProvider, theme, query client…
│   ├── router.tsx
│   └── layouts/
│       └── root-layout.tsx   # header, <main>, footer, AnimatedOutlet
├── pages/                    # route-level components (or routes/ with file routing)
│   ├── home/
│   │   ├── index.tsx
│   │   └── sections/         # hero.tsx, features.tsx … page-specific choreography lives here
│   └── …
├── components/
│   ├── ui/                   # shadcn/ui generated components (owned, editable)
│   ├── motion/               # reusable animation primitives: reveal-on-scroll, staggered-list…
│   ├── three/                # SceneCanvas, shared 3D helpers (lazy-loaded)
│   └── …                     # shared product components
├── features/                 # optional: domain modules (billing/, projects/) with own components/hooks
├── hooks/                    # shared hooks
├── lib/
│   ├── motion-tokens.ts      # durations, easings, springs, stagger
│   ├── utils.ts              # cn() from shadcn
│   └── …
├── styles/
│   ├── index.css             # @import "tailwindcss"; @theme tokens; base layer
│   └── tokens.css            # CSS motion + colour variables (or inside index.css)
├── assets/                   # fonts, images, models (large models → public/ or CDN)
├── test/
│   └── setup.ts              # @testing-library/jest-dom, matchMedia mock
└── main.tsx
e2e/                          # Playwright specs
public/                       # static files served as-is (glb, hdr, og images)
```

Rules:

- `components/motion/` holds primitives with no page knowledge. Choreography (which section reveals when) lives in the page/section files.
- `components/three/` is only imported through `React.lazy` so three.js never lands in the main bundle.
- Keep `components/ui/` close to shadcn's output so future `shadcn add` / diff updates stay manageable.

## Test setup snippet

```ts
// src/test/setup.ts
import "@testing-library/jest-dom/vitest";

// jsdom lacks matchMedia and IntersectionObserver, which motion features rely on
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

class IO {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
// @ts-expect-error minimal stub
window.IntersectionObserver = IO;
```

```ts
// vite.config.ts (test section)
test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], globals: true },
```

Unit tests assert behaviour and final states (content present, ARIA correct, handlers fire), not animation frames. Use Playwright for visual and motion checks.

## package.json scripts (suggested)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc -b --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test"
  }
}
```

Keep whatever the Vite template generated; add only missing scripts.

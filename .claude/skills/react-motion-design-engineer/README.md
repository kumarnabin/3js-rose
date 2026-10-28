# react-motion-design-engineer

A Claude Skill that makes Claude work like a senior React engineer, UI/UX designer, motion designer and creative coder. It builds and improves React + TypeScript interfaces such as landing pages, SaaS dashboards, portfolios, product sites and Three.js / React Three Fiber scenes. It picks animation libraries based on what the task needs, and it treats accessibility, reduced motion, performance and real verification as requirements.

This README is for people. Claude reads `SKILL.md`, which loads the other files only when a task needs them.

## What it does

| Mode | Example request |
|---|---|
| Build | "Build a landing page for our analytics product in React + Tailwind." |
| Enhance | "Our dashboard looks dated. Modernise it without breaking anything." |
| Recreate | "Make my portfolio scroll like <reference site>." (patterns only, never their assets or branding) |
| Animate | "Add tasteful page transitions and list animations." |
| Explore | "Should I use Motion or GSAP for a pinned scroll story?" |
| Audit | "Review this page for animation jank and accessibility." |

Defaults: React, TypeScript, Vite, Tailwind CSS, shadcn/ui and Radix, Motion for React, GSAP for complex timelines, React Three Fiber for 3D, Lucide icons, and Vitest, Testing Library and Playwright for tests. The skill follows whatever an existing project already uses, and it adds dependencies only when the task needs them.

## Structure

```text
react-motion-design-engineer/
├── SKILL.md                         # entry point: workflow, defaults, rules, file index
├── README.md                        # this file
├── references/
│   ├── animation-libraries.md       # Motion, GSAP, React Spring, Anime.js, AutoAnimate, Theatre.js, Rive, Lottie
│   ├── react-component-libraries.md # shadcn/ui, Radix, animated copy-paste registries
│   ├── 3d-webgl-graphics.md         # Three.js, R3F, drei, shaders, Spline, OGL, Babylon, Pixi
│   ├── design-inspiration.md        # studying references, Recreate-mode rules
│   ├── scroll-and-transitions.md    # scroll-linked/triggered, pinning, Lenis, route & view transitions
│   ├── typography-icons-and-assets.md
│   ├── accessibility-and-performance.md
│   ├── implementation-patterns.md   # tokens, providers, reusable animated components (code)
│   └── resource-catalog.md          # every URL with category, compatibility, licence status
├── templates/
│   ├── react-project-structure.md
│   ├── animation-specification.md
│   ├── ui-review-checklist.md
│   └── project-implementation-plan.md
└── examples/
    ├── animated-landing-page.md
    ├── saas-dashboard.md
    ├── interactive-portfolio.md
    └── realistic-threejs-scene.md
```

## Installation

### Claude Code: personal (all your projects)

Claude Code finds personal skills at `~/.claude/skills/<skill-name>/SKILL.md`.

macOS / Linux / Git Bash:

```bash
cp -r react-motion-design-engineer ~/.claude/skills/
# or keep the source elsewhere and symlink it:
ln -s "$PWD/react-motion-design-engineer" ~/.claude/skills/react-motion-design-engineer
```

Windows PowerShell:

```powershell
Copy-Item -Recurse .\react-motion-design-engineer "$env:USERPROFILE\.claude\skills\"
# or, to symlink (needs Developer Mode or an elevated shell):
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\skills\react-motion-design-engineer" -Target (Resolve-Path .\react-motion-design-engineer)
```

### Claude Code: project (shared with your team through git)

```bash
mkdir -p .claude/skills
cp -r react-motion-design-engineer .claude/skills/
git add .claude/skills/react-motion-design-engineer
```

Claude Code watches `~/.claude/skills/` and the project's `.claude/skills/`, so a new or edited skill shows up without a restart. If you create a skills directory that didn't exist before during a session, run `/reload-skills` once.

### claude.ai (web and desktop apps)

1. Zip the folder so that the archive contains `react-motion-design-engineer/SKILL.md`:

   ```bash
   zip -r react-motion-design-engineer.zip react-motion-design-engineer
   ```

2. In Claude, open **Customize → Skills**, click **+**, then **Create skill → Upload a skill**, and choose the ZIP. Older versions of the interface put this under **Settings → Capabilities**.
3. Custom skills need a paid plan with code execution turned on.

The frontmatter contains only `name` and `description`. Those are the fields that claude.ai uploads and the Agent Skills spec accept, so the same folder works everywhere.

## Usage

The skill loads on its own when a request matches its description, for example:

> "Add scroll-triggered reveals and a pinned feature section to `src/pages/Home.tsx`. Respect reduced motion."

You can also start it explicitly in Claude Code:

```
/react-motion-design-engineer audit the pricing page for motion and accessibility issues
```

What to expect: Claude first reads `package.json` and the relevant files. It then proposes or writes a motion spec, implements the changes using the project's existing conventions, runs typecheck, build and tests plus browser checks where it can, and reports which files changed, the decisions it made, which checks it actually ran and any open issues.

## Maintenance

- The catalog records when each resource was checked. Libraries change quickly, so the skill tells Claude to check current official docs before writing code against a library.
- Keep `SKILL.md` under 500 lines. Put new detail in `references/` and add a row to the file index in `SKILL.md`.
- Keep every link one level deep from `SKILL.md`.

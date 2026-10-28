# ai-visual-asset-engineer

A portable agent skill that turns prompts and reference images into real visual asset files for React and other web projects. It covers generated PNGs, optimised WebP and AVIF, hand-written SVG, animated SVG and typed React SVG components. It checks every result and reports only what it actually produced.

It's written to the open [Agent Skills](https://agentskills.io/specification) format: a folder with a `SKILL.md`, plus `references/` and `scripts/`. It runs in Claude Code, OpenAI Codex, Google Antigravity, Gemini CLI, Cursor, GitHub Copilot, OpenCode, Amp and other agents that load the same format.

## What it can and can't do

| Capability | Requires |
|---|---|
| Write SVG illustrations, icons, logos, diagrams, animated SVG, React SVG components | Nothing extra; the agent writes the code |
| Convert and resize images to WebP, AVIF or PNG with alpha preserved | One of: `sharp` in the project (recommended), ImageMagick 7, `cwebp`, or `ffmpeg` with libwebp |
| Check format, size, transparency and SVG markup | Node 18+ (bundled script, no dependencies) |
| Check browser rendering and rasterise SVG to PNG | Playwright in the project (`npm i -D @playwright/test && npx playwright install chromium`) |
| **Generate raster images** | **An image-generation tool in the agent**: Codex built-in `image_gen`, Antigravity built-in, an MCP server, or an API key (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `REPLICATE_API_TOKEN`) for the bundled script |

The skill can't generate images by itself. If no generator is connected, the agent tells you so and still offers SVG, CSS or canvas work, conversion of images you supply, and setup steps. See `references/image-generation-integrations.md` §9.

## Structure

```text
ai-visual-asset-engineer/
├── SKILL.md                                  # entry point: rules, workflow, script + reference index
├── README.md
├── references/
│   ├── image-generation-integrations.md      # tools per agent, providers, capabilities, how to connect
│   ├── prompt-templates.md                   # realistic, transparent, illustration, texture, sprite, edit, SVG, icon, animation
│   ├── svg-authoring.md                      # vector standards, icons, logos, diagrams, animated SVG, SVGO
│   ├── asset-conversion-workflow.md          # formats, sizes, engines, transparency, favicons, naming
│   ├── react-integration-workflow.md         # ResponsiveImage, next/image, SVGR, typed icon/illustration components
│   └── validation-and-troubleshooting.md     # checks per asset type, report template, fixes
└── scripts/
    ├── detect-environment.mjs                # project conventions, converters, API-key presence
    ├── generate-image.mjs                    # OpenAI / Gemini / Replicate; dry-run unless --confirm
    ├── convert-image.mjs                     # sharp → ImageMagick → cwebp → ffmpeg; variants; no overwrite
    ├── verify-asset.mjs                      # format, dimensions, alpha (incl. fake transparency), SVG checks
    ├── render-preview.mjs                    # Chromium render on light/dark/checkerboard; SVG → PNG
    └── lib/image-info.mjs                    # shared header/pixel parsing
```

## Installation

Copy (or symlink) the whole `ai-visual-asset-engineer` folder into the skills directory of each agent you use. These paths were checked against each vendor's docs on 2026-10-28:

| Agent | Project (shared with the repo) | Personal (all projects) |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| OpenAI Codex | `.agents/skills/` | `~/.agents/skills/` |
| Google Antigravity | `.agents/skills/` (legacy `.agent/skills/`) | `~/.gemini/config/skills/` (IDE also reads `~/.gemini/antigravity/skills/`; CLI: `~/.gemini/antigravity-cli/skills/`) |
| Gemini CLI | `.agents/skills/` or `.gemini/skills/` | `~/.agents/skills/` or `~/.gemini/skills/` |
| Cursor, GitHub Copilot, OpenCode, Amp | `.agents/skills/` | see each agent's docs |

`.agents/skills/` in a repo covers most agents at once. Claude Code also needs `.claude/skills/`.

macOS / Linux / Git Bash:

```bash
# personal, Claude Code + Codex/Gemini CLI
mkdir -p ~/.claude/skills ~/.agents/skills
cp -r ai-visual-asset-engineer ~/.claude/skills/
cp -r ai-visual-asset-engineer ~/.agents/skills/

# project, most agents
mkdir -p .claude/skills .agents/skills
cp -r ai-visual-asset-engineer .claude/skills/
cp -r ai-visual-asset-engineer .agents/skills/
```

Windows PowerShell:

```powershell
$src = ".\ai-visual-asset-engineer"
foreach ($d in "$env:USERPROFILE\.claude\skills", "$env:USERPROFILE\.agents\skills", "$env:USERPROFILE\.gemini\config\skills") {
  New-Item -ItemType Directory -Force $d | Out-Null
  Copy-Item -Recurse $src $d
}
```

To keep a single copy, symlink it instead. On Windows that needs Developer Mode or an elevated shell:

```powershell
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.claude\skills\ai-visual-asset-engineer" -Target "$env:USERPROFILE\.agents\skills\ai-visual-asset-engineer"
```

Cross-agent installer: `npx skills add <git-repo-or-path> -a <agent>` (vercel-labs/skills; Node ≥ 22.20) detects installed agents and symlinks or copies the skill for each one.

### Reloading

- **Claude Code** watches its skills folders. If you create a new top-level skills folder during a session, run `/reload-skills`.
- **Codex** detects changes automatically; restart it if the skill doesn't appear.
- **Gemini CLI**: `/skills reload`.
- **Antigravity**: lists active skills under Customizations.

### Enabling image generation

See `references/image-generation-integrations.md` for the details. In short:

- **Codex or Antigravity:** sign in. Built-in generation is already available.
- **Claude Code:** add an MCP server, e.g. `claude mcp add --transport http --scope user fal https://mcp.fal.ai/mcp-relay`, or set an API key.
- **Any agent with an API key:** set `OPENAI_API_KEY`, `GEMINI_API_KEY` or `REPLICATE_API_TOKEN` in your environment and restart the agent. Never put keys in project files.

Confirm with `node <skill-dir>/scripts/detect-environment.mjs`.

## Usage

Ask naturally. The skill triggers on image, icon, SVG and asset requests:

> "Create a transparent PNG of a sage-green ceramic coffee dripper for the hero, convert it to WebP at 640/1280/1920 and use it in `src/components/Hero.tsx`."

> "Make an SVG icon set (upload, download, share) matching lucide's style, as typed React components in `src/components/icons/`."

> "Turn `design/logo.png` into a clean SVG and produce favicon PNGs."

Or invoke it explicitly: `/ai-visual-asset-engineer` in Claude Code, Antigravity and Gemini CLI, or `$ai-visual-asset-engineer` in Codex.

The agent reads the project first. It shows a dry-run plan before any paid generation. It saves files in the project without overwriting, converts and verifies them, and reports the actual files with their formats, sizes and check results.

## Running the scripts yourself

```bash
node scripts/detect-environment.mjs .
node scripts/generate-image.mjs --provider gemini --list-models
node scripts/generate-image.mjs --provider openai --prompt "…" --out public/assets/hero.png            # dry run
node scripts/generate-image.mjs --provider openai --prompt "…" --out public/assets/hero.png --confirm  # billed call
node scripts/convert-image.mjs public/assets/hero.png --format webp --widths 640,1280,1920 --out-dir public/assets
node scripts/verify-asset.mjs public/assets/hero*.webp --expect-format webp
node scripts/render-preview.mjs public/assets/hero-1280w.webp src/assets/logo.svg --out preview.png
```

## Maintenance

Provider model names and parameters change often. The integrations guide records the date it was last checked, and `--list-models` shows what a key can actually use. Keep `SKILL.md` short, and put detail in `references/`.

# Image-Generation Integrations

Which image-generation tools an agent may have, what each needs, what it can do, and how to connect one when none is available. Facts were checked on **2026-10-28**. Model names and capabilities change often, so confirm with `generate-image.mjs --list-models` or the provider's docs before relying on a specific model.

## Contents

1. Detection order (do this first)
2. By agent environment
3. Provider capability matrix
4. OpenAI Images API
5. Google Gemini image models
6. Replicate and fal.ai (incl. Recraft SVG)
7. MCP servers (Claude Code and other MCP clients)
8. Background removal
9. Connecting a provider (keys and setup)
10. Cost, privacy and licensing rules
11. When nothing is available

---

## 1. Detection order (do this first)

1. **Your own tool list.** Look for a built-in or MCP tool that generates or edits images. Typical signs are names like `image_gen`, `generate_image`, `create_image`, `mcp__replicate__*` or `mcp__fal__*`, or a description mentioning image generation. Agent-native tools come first: they use the agent's own login and know how to return files.
2. **API credentials** for the bundled script: `node <skill-dir>/scripts/detect-environment.mjs` reports which of `OPENAI_API_KEY`, `GEMINI_API_KEY`/`GOOGLE_API_KEY`, `REPLICATE_API_TOKEN`, `FAL_KEY`, `STABILITY_API_KEY` and `RECRAFT_API_TOKEN` are set. It reports names only, never values.
3. **Nothing found** means you can't generate raster images. You can still author SVG, CSS and canvas art, and convert or optimise images the user supplies. Tell the user plainly, and show them §9.

Never describe an image you didn't generate as if it exists. Never write a placeholder file and present it as the asset.

## 2. By agent environment

| Agent | Native image generation | Notes |
|---|---|---|
| **Claude Code** | **None built in** (it can view images with Read, not create them) | Add an MCP server (§7) or an API key for `generate-image.mjs` |
| **OpenAI Codex** (CLI / IDE / app) | Yes: built-in `image_gen` tool, used by the system `$imagegen` skill, signed in with the ChatGPT/Codex account (no API key) | Outputs are saved under `$CODEX_HOME/generated_images/…`. **Copy them into the project**, then convert and verify. Usage counts against Codex limits. To edit a local image, load it first (`view_image`). |
| **Google Antigravity** | Yes: the agent can generate images with Gemini image models (Nano Banana family) | The tool name isn't published. Find it in the tool list. Copy the outputs into the project. Images carry a SynthID watermark. |
| **Gemini CLI** | No dedicated image tool confirmed | Use `GEMINI_API_KEY` with `generate-image.mjs`, or an MCP server |
| Cursor, GitHub Copilot, OpenCode, Amp, others | Depends on configured MCP servers / extensions | Inspect the tool list; otherwise use API keys |

## 3. Provider capability matrix

| Provider | Credential | Text→image | Reference images / edits | Real transparency | Vector (SVG) | Notes |
|---|---|---|---|---|---|---|
| OpenAI Images API | `OPENAI_API_KEY` | ✅ | ✅ up to 16 refs, optional mask | ✅ `background: "transparent"` (png/webp); model support varies, see §4 | ❌ | base64 response |
| Gemini API | `GEMINI_API_KEY` | ✅ | ✅ inline images (up to ~14 depending on model) | ❌ (flat RGB; "transparent" prompts paint a checkerboard) | ❌ | SynthID watermark |
| Replicate | `REPLICATE_API_TOKEN` | ✅ many models (FLUX, Recraft…) | model-specific | model-specific | ✅ `recraft-ai/recraft-v3-svg`, `recraft-ai/recraft-v4-svg` | outputs expire after ~1 h; download promptly |
| fal.ai | `FAL_KEY` | ✅ | model-specific | model-specific | ✅ `fal-ai/recraft/v4/text-to-vector` | queue API |
| Codex built-in | Codex login | ✅ | ✅ | check per model | ❌ | copy from `$CODEX_HOME/generated_images` |
| Antigravity built-in | Google login | ✅ | ✅ | ❌ (Gemini models) | ❌ | |

Generated "SVG" from Recraft and similar is real vector output, but it's often heavy and messy. Run SVGO and `verify-asset.mjs`, and inspect it before using it as an editable source.

## 4. OpenAI Images API

- Endpoints: `POST /v1/images/generations` (JSON) and `POST /v1/images/edits` (multipart: `image[]` for each reference, optional `mask`).
- Models at last check: `gpt-image-2`, `gpt-image-2.5-sunburst` (most capable), `gpt-image-2.5-flare` (fast) and `chatgpt-image-latest`. `gpt-image-1` was shut down on 2026-10-23, and `gpt-image-1.5` and `gpt-image-1-mini` are scheduled to shut down on 2026-12-01. Run `node scripts/generate-image.mjs --provider openai --list-models` to see what the key can access, then pass `--model` or set `OPENAI_IMAGE_MODEL`.
- `size`:
  - `auto`, `1024x1024`, `1536x1024` or `1024x1536`.
  - Newer models also accept custom sizes: both sides multiples of 16, aspect ratio 1:3 to 3:1, at most 3840 px per edge.
- `quality`: `low | medium | high | auto`. Newer models add higher tiers.
- `output_format`: `png | webp | jpeg`. `output_compression` (0–100) applies to webp and jpeg.
- `background: "transparent"` needs png or webp output. Transparency support differs by model, and was described as "preview" for `gpt-image-2`. **Always verify the result** with `verify-asset.mjs --expect-alpha`. If it fails, use the chroma-key and background-removal route.
- Masks: a PNG with alpha, the same size as the first image. Editing is prompt-guided, so the model may not follow the mask's exact shape.
- Good at: following instructions, short text rendering, and edits that preserve identity.

```bash
node scripts/generate-image.mjs --provider openai --model gpt-image-2 --prompt-file prompt.txt \
  --size 1536x1024 --quality high --out public/assets/hero-coffee.png            # dry run
# … get approval, then append --confirm
node scripts/generate-image.mjs --provider openai --prompt "…" --transparent --out src/assets/mug-cutout.png --confirm
node scripts/generate-image.mjs --provider openai --prompt "Keep the product unchanged; replace the background with…" \
  --ref design/product-raw.jpg --out public/assets/product-studio.png --confirm
```

## 5. Google Gemini image models

- Endpoint used by the script: `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with header `x-goog-api-key`, and `generationConfig.responseModalities: ["TEXT","IMAGE"]`.
  - Aspect ratio goes in `generationConfig.imageConfig.aspectRatio` (e.g. `"16:9"`).
  - Size tier goes in `imageConfig.imageSize` (`"1K" | "2K" | "4K"`). This field name comes from third-party sources only.
  - Images come back as `candidates[0].content.parts[].inlineData` (base64).
- Google also documents a newer Interactions API (`/v1beta/interactions`). The script uses `generateContent`, which is still a supported core API.
- Models a key could access at last check:
  - `gemini-3.1-flash-image` (default in the script)
  - `gemini-3.1-flash-lite-image`
  - `gemini-3-pro-image` (highest quality)
  - `gemini-2.5-flash-image` (legacy)
  
  Run `--list-models` to see your key's list. Imagen models (`:predict`) have been shut down.
- **No real transparency.** The script refuses `--transparent` for Gemini and points to the chroma-key workflow.
- Every output carries an invisible SynthID watermark. The script records this in the manifest.
- Reference images are sent as `inline_data` parts (`--ref`). Good at: multi-image composition, style transfer, consistent characters across images.

## 6. Replicate and fal.ai (incl. Recraft SVG)

**Replicate** (`REPLICATE_API_TOKEN`)

- Send `POST https://api.replicate.com/v1/models/{owner}/{name}/predictions` with body `{ "input": { … } }` and header `Prefer: wait`, which blocks for up to 60 s. After that, poll `GET /v1/predictions/{id}`.
- `output` holds `replicate.delivery` URLs. Fetch them with the auth header; they expire after about an hour.
- Input schemas differ per model. Read the model page's API tab, then pass extra fields with `--input-json`.

```bash
node scripts/generate-image.mjs --provider replicate --model black-forest-labs/flux-schnell \
  --prompt "…" --input-json '{"aspect_ratio":"16:9","output_format":"png"}' --out public/assets/hero.png --confirm
node scripts/generate-image.mjs --provider replicate --model recraft-ai/recraft-v4-svg \
  --prompt "flat line icon of a paper plane" --out src/assets/icons/paper-plane.svg --confirm
```

**fal.ai** (`FAL_KEY`)

- Queue API:
  - Submit with `POST https://queue.fal.run/{owner}/{app}` and header `Authorization: Key $FAL_KEY`. The response includes a `request_id`.
  - Poll `GET https://queue.fal.run/{owner}/{app}/requests/{id}/status`, then fetch the result from `…/requests/{id}`, which holds `images[].url`.
- SVG model: `fal-ai/recraft/v4/text-to-vector` with inputs `prompt`, `image_size`, `colors` and `background_color`.
- The bundled script doesn't call fal. Use fal's MCP server (§7), or call the queue API with curl after approval.

## 7. MCP servers (Claude Code and other MCP clients)

Add one when the user wants generation available as agent tools. Claude Code syntax: `claude mcp add [--transport stdio|http] [--scope local|project|user] [--env K=V] <name> -- <command>`. Project scope writes `.mcp.json`.

| Server | Maintainer | Add (Claude Code) |
|---|---|---|
| Replicate | Replicate (official) | Remote: `claude mcp add --transport http replicate https://mcp.replicate.com`, or local: `claude mcp add --env REPLICATE_API_TOKEN=<token> replicate -- npx -y replicate-mcp` |
| fal.ai | fal (official) | `claude mcp add --transport http --scope user fal https://mcp.fal.ai/mcp-relay`, then `/mcp` → authenticate in the browser |
| Community servers (e.g. `fal-mcp-server`, `@gongrzhe/image-gen-server`, `mcp-server-stability-ai`) | Third-party | Review the source and permissions before installing. These names weren't checked against npm. |

After adding, restart or reload the agent and confirm the new tools appear in its tool list. Codex, Antigravity, Gemini CLI and Cursor also support MCP. Use their own configuration format (e.g. `~/.codex/config.toml` `[mcp_servers.*]`) and check their docs.

## 8. Background removal

Use these when the generator can't output transparency, or to cut out a user's photo.

| Tool | Runs | Command / API | Licence / notes |
|---|---|---|---|
| rembg | Local (Python 3.11–3.13) | `pip install "rembg[cpu,cli]"`, then `rembg i in.png out.png` (`-a` for alpha matting; `rembg p indir outdir` for folders) | MIT; downloads models on first run |
| @imgly/background-removal-node | Local (Node) | `import { removeBackground } from "@imgly/background-removal-node"` | **AGPL**: needs licence review before adding to a product |
| ImageMagick flood fill | Local | `magick in.png -fuzz 12% -fill none -draw "color 0,0 floodfill" out.png` | Only for truly flat backgrounds |
| remove.bg | Hosted API | `POST https://api.remove.bg/v1.0/removebg` with header `X-Api-Key` | Uploads the image, paid. The service moves to Leonardo.Ai on 2026-12-01, so check the docs. |
| OpenAI edit | Hosted | Edit request asking for a transparent background, plus `background: "transparent"` | Verify the alpha afterwards |

## 9. Connecting a provider (keys and setup)

Tell the user which option fits their agent:

- **Codex or Antigravity:** built-in generation is already available once signed in. No key is needed.
- **Any agent, via API key:** create a key in the provider console, then make it available to the agent's shell. Never paste keys into project files, chat or prompts.

  PowerShell (persists for new terminals):

  ```powershell
  setx OPENAI_API_KEY "sk-…"      # or GEMINI_API_KEY / REPLICATE_API_TOKEN
  ```

  bash/zsh (add to `~/.bashrc` or `~/.zshrc`):

  ```bash
  export GEMINI_API_KEY="…"
  ```

  Restart the agent so it inherits the variable, then run `node <skill-dir>/scripts/detect-environment.mjs` to confirm.
- **Claude Code and other MCP clients:** add an MCP server (§7).
- Project `.env` files: only if the project already uses one and `.env` is git-ignored. The script reads real environment variables only. It doesn't parse `.env`.

## 10. Cost, privacy and licensing rules

- A generation call **costs money** and sends the prompt and any reference images **to a third party**. Get the user's approval before the first paid call, state the provider and model, and keep iterations deliberate. The script dry-runs unless `--confirm` is passed.
- Don't send confidential images (unreleased products, people's photos, customer data) to a provider without explicit permission.
- Generated images may have usage terms, watermarks (Gemini SynthID) or restrictions. Note them in the manifest and the report, and don't claim exclusive rights.
- Don't generate real people's likenesses, trademarks or logos the user doesn't own, or imitations of a named living artist's style.

## 11. When nothing is available

Say so in one or two sentences, then offer what's actually possible:

1. Hand-authored **SVG** (illustrations, icons, diagrams, patterns, animated SVG).
2. **CSS art** (gradients, shapes, blend modes) or a **canvas/WebGL** rendering that runs at runtime or is exported to PNG/WebP via `render-preview.mjs`.
3. Optimising and converting **images the user provides**.
4. Setup instructions from §9, so a raster can be generated after they connect a tool.

Don't create placeholder rasters, stock-photo URLs or base64 blobs to fill the gap unless the user explicitly asks for placeholders. If they do, name the files `placeholder-*` and list them as such in the report.

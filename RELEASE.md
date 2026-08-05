# TeamThink Desktop Releases

## v0.2.0 — Phase 0 chat + desktop shell

First downloadable desktop build. Browser WebGPU is limited; this Electron
shell enables Chromium WebGPU flags and serves the static TeamThink app.

### Download (after CI / local pack)

| Platform | Artifact |
|----------|----------|
| Linux | `TeamThink-0.2.0.AppImage` or `teamthink-desktop-0.2.0.tar.gz` |
| macOS | `TeamThink-0.2.0.dmg` (via GitHub Actions on tag) |
| Windows | NSIS installer (via GitHub Actions on tag) |

Local pack:

```bash
pnpm desktop:pack
# → desktop/release/
```

### Run (Linux AppImage)

```bash
chmod +x TeamThink-0.2.0.AppImage
./TeamThink-0.2.0.AppImage
```

Set `NEXT_PUBLIC_SIGNAL_WS_URL` at **build** time (static export) so the
packaged app can reach your signaling Worker.

### Publish a GitHub Release

```bash
git tag v0.2.0
git push origin v0.2.0
```

`.github/workflows/release-desktop.yml` builds installers and attaches them
to the release for the tag.

For **major/minor** tags, rewrite “What’s new” as simplified use-case scenarios
(agent rule: `.cursor/rules/release-notes.mdc`). Keep the GitHub Social preview
in sync if art changed (`.cursor/rules/og-social-preview.mdc`).

### What’s new in 0.2.0

#### 1. Multi-turn threads (persist, pin, archive, export)

You chat in a room, then lose the history when the page reloads. Threads now
save per room. You can rename them, pin important ones, archive old ones, and
export to JSON, Markdown, or HTML.

#### 2. System prompts & presets

You reuse the same system prompt and settings across chats. Pick a built-in
preset, or save your own. The preset sets the system prompt and default sampler
values for the next run.

#### 3. Sampler panel wired into generation

You need to change temperature, top-p, top-k, max tokens, seed, stop sequences,
or penalties. The sampler panel sends those values into the grid generation
path for each prompt.

#### 4. JSON mode + optional schema

You need model output as JSON for another program. Turn on JSON mode and
optionally add a schema. The model is instructed to return JSON only, and valid
JSON is pretty-printed when the reply finishes.

#### 5. Streaming markdown, code copy, thinking collapse

You want readable output while tokens stream. Replies render as markdown.
Code blocks have a copy button. Long `<think>` / reasoning sections collapse so
the main answer stays easy to read.

#### 6. Electron desktop app with WebGPU flags + CI release

You want to contribute more GPU capacity, but the browser limits WebGPU or
VRAM. Download the Electron desktop app. It runs Chromium with WebGPU flags
enabled and ships for Linux, macOS, and Windows through the `v*` release
pipeline.

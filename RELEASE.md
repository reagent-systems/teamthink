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

### What’s new in 0.2.0

#### 1. Multi-turn threads (persist, pin, archive, export)

You open a room with teammates, chase three half-finished ideas at once, and
lose the thread when the tab refreshes. Now each room keeps real conversations:
rename them, pin the ones that matter, archive the noise, and export to JSON,
Markdown, or HTML when you need to share or file something away.

#### 2. System prompts & presets

You keep rewriting the same “be concise / act like a code reviewer / answer in
JSON” preamble every time you switch models. Pick a builtin preset—or save your
own—and the system prompt plus sampler defaults come with it, so the next
session starts in character instead of from scratch.

#### 3. Sampler panel wired into generation

You get a model that rambles, or one that collapses into the same phrase, and
the old console gave you no knobs. Open the sampler panel: temperature, top-p,
top-k, max tokens, seed, stop sequences, and penalties flow straight into the
grid’s generation path, so you tune the run the same way you would in a local
desktop LLM app.

#### 4. JSON mode + optional schema

You’re piping answers into another tool and free-form prose keeps breaking the
parser. Flip on JSON mode, optionally paste a schema, and TeamThink steers the
model toward a single JSON value—then pretty-prints it when the stream lands.

#### 5. Streaming markdown, code copy, thinking collapse

You’re watching tokens crawl out as a monospace wall and can’t skim the
structure. Streams render as markdown as they arrive: headings and emphasis
read cleanly, fenced code gets a one-click copy, and long `<think>` /
reasoning blocks tuck into a collapsible panel so the answer stays in focus.

#### 6. Electron desktop app with WebGPU flags + CI release

You want to contribute more processing to the network, but the browser tab
caps what WebGPU can see—or flakes on large VRAM. Download the Electron desktop
app we just released: Chromium with WebGPU flags enabled, packaged for Linux,
macOS, and Windows via the `v*` release pipeline.

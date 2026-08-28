# TeamThink Desktop Releases

## v0.10.0 — Phase 2 complete: batch scrape, workspaces, Firecrawl, PII, watch

Finishes Phase 2 web context tooling.

### What's new in 0.10.0

#### 33–34, 36–39, 41, 43. Extended web agent toolkit

- **News & image search** — `news_search` and `image_search` agent tools
- **Browser interact** — `browser_interact` with wait/re-snapshot for static pages
- **JSON extract** — `extract_json` pulls JSON-LD, Open Graph, and tables
- **Batch scrape queue** — paste multiple URLs; progress tracked per room
- **Change tracking** — watch URLs and check for content diffs
- **PII redaction** — optional scrub before scrape/RAG ingest
- **Firecrawl adapter** — paste API key in Web context panel to route scrapes through Firecrawl
- **Knowledge workspaces** — named collections; scrape URLs straight into workspace RAG docs

---

## v0.9.0 — Web scrape, crawl, search, agent mode (Phase 2 start)

Live-web context tools via the signaling Worker proxy, agent mode for multi-step research, and citation footnotes in chat.

### What's new in 0.9.0

#### 29–32, 35. Web scrape, crawl, sitemap, search, PDF parse

You need page content without CORS headaches. Enable **Web tools** in the session sidebar — the Worker fetches URLs and returns Markdown. Agent tools: `web_scrape`, `web_crawl`, `web_sitemap`, `web_search`, and `parse_pdf`.

#### 40. Agent mode

You have a research goal, not a single question. Turn on **Agent mode** — the model runs up to eight tool rounds (search → scrape → answer) with `[1]`/`[2]` citation prompts.

#### 42. Self-hosted crawler worker

Scrape and crawl routes run on the same Cloudflare Worker as signaling (`/scrape`, `/crawl`, `/sitemap`, `/search`, `/parse-pdf`).

#### 44. Citation UI

Assistant messages render `[n]` as clickable footnotes; a source list appears below the reply with links to scraped URLs and PDFs.

---

## v0.8.0 — WASM CPU models, audio I/O, MCP client (Phase 1 complete)

Finishes Phase 1: GGUF-class WASM inference, Whisper STT + browser TTS, and MCP tool servers in the session.

### What's new in 0.8.0

#### 15. GGUF / WASM CPU path

You lack WebGPU or want a low-VRAM fallback. Pick **Qwen2.5 0.5B (WASM CPU)** or **SmolLM2 360M (WASM CPU)** — Transformers.js ONNX models on the WASM backend via the `gguf` engine.

#### 19. Audio I/O

You want hands-free chat. Use **Mic** in the inference console for Whisper Tiny transcription, and enable **Read replies aloud** for browser text-to-speech on completed assistant messages.

#### 22. MCP client

You have MCP tool servers. Connect an HTTP MCP endpoint in **MCP servers**, enable **MCP tools**, and remote tools merge into the agent loop alongside built-in helpers.

---

## v0.7.0 — Anthropic Messages API + TypeScript/Python SDKs

Claude-shaped clients and scriptable SDKs for the local gateway.

### What’s new in 0.7.0

#### 25. Anthropic-compatible Messages API

You use Claude-style clients or libraries. The desktop gateway accepts `POST /v1/messages` and returns Anthropic-shaped responses while routing through the mesh.

#### 28. TypeScript + Python SDKs

You want to script chat and embeddings. Import `TeamThinkClient` from `lib/sdk/client.ts` (TypeScript) or `sdk/python/teamthink_client.py` (Python) — list models, chat, embed, and call the Messages API against `http://127.0.0.1:11434`.

---

## v0.6.0 — Hybrid RAG, agent tools, OpenAI gateway, headless compute

Search modes for document retrieval, built-in agent tools, a local OpenAI-compatible API from the desktop app, headless compute tabs, and the `tt` CLI.

### What’s new in 0.6.0

#### 21. Hybrid BM25 + vector retrieval

You want keyword matches and semantic similarity together. In **Documents**, enable **RAG on send** and pick **Hybrid**, **Vector only**, or **BM25 only** before sending a prompt.

#### 23. Tool / function calling

You need the model to look up docs or run simple helpers. Enable **Agent tools** in the sidebar — built-in `rag_search`, `calculator`, and `current_time` run through the mesh scheduler with up to four tool rounds per turn.

#### 24. OpenAI-compatible local gateway

You want Cursor or other OpenAI clients to hit your mesh. The desktop app listens on `http://127.0.0.1:11434/v1` for `/v1/models`, `/v1/chat/completions`, and `/v1/embeddings` while a session is open.

#### 26. Headless compute mode

You want a machine to donate GPU without the chat UI. Open `/s?r=<room>&headless=1` (or `mode=compute`) and keep the tab open — model load, telemetry, and peer list stay visible.

#### 27. CLI (`tt`)

You want terminal access to the gateway. Run `pnpm tt room`, `pnpm tt models`, `pnpm tt chat -m <model> "hello"`, or `pnpm tt embed -m <model> "text"` against a running desktop session.

---

## v0.5.0 — Vision chat, embeddings, document RAG

Multimodal prompts, on-device embeddings, and offline document retrieval for the mesh.

### What’s new in 0.5.0

#### 17. Embeddings engine

You need vectors for semantic search. MiniLM L6 runs in the inference worker with
mean-pooled, normalized outputs suitable for RAG and OpenAI-shaped `/v1/embeddings`
clients.

#### 18. Vision & multimodal chat

You want to ask about a photo. Pick **SmolVLM 256M (vision)**, attach an image,
and send — the grid routes through task-based Transformers.js inference with
image data in the conversation.

#### 20. Document RAG (offline-capable)

You have notes or docs to ground answers. Upload `.txt`/`.md` or paste text in the
**Documents** panel, enable **RAG on send**, and retrieved chunks with `[1]`/`[2]`
citations are injected into the system prompt.

---

## v0.4.0 — Phase 1 model hub (HF browser + import)

Search Hugging Face, validate repos, and add sharded grid models from the session UI.

### What’s new in 0.4.0

#### 13. In-app Hugging Face model browser

You want more models than the built-in list. Open **Model hub → Search**, filter by
text/vision/embedding, size, and quant tags, then **Add** a public safetensors repo
to your grid registry.

#### 14. Custom model import with validation

You have a specific HF repo id. Paste it under **Import repo**, run **Validate** to
check architecture support and safetensors weights, then **Add to grid**. Ungated
repos with supported dense decoders (Llama, Qwen, Gemma, Phi, Mistral families) work.

#### 16. Quantization filter + VRAM estimate

You need a smaller quant or want to know if a model fits. Filter search results by
q4/q8/f16 hints and see an estimated VRAM figure on validated imports before loading.

---

## v0.3.0 — Phase 0 polish (model lifecycle → onboarding)

Completes ROADMAP Phase 0 features 6–12: model load/unload UI, keyboard chat,
invite UX, capability dashboard, telemetry, error recovery, and onboarding.

### What’s new in 0.3.0

#### 6. Model load / unload lifecycle UI

You pick a model and need to see download progress, cancel a slow warm, or free
VRAM when done. The Model lifecycle panel shows a progress bar, VRAM fit meter,
Cancel load, Unload, and Keep warm vs Evict after 15 minutes idle.

#### 7. Keyboard-first chat

You want to send fast and control the session from the keyboard. Use ⌘/Ctrl+Enter
to send. Slash commands: `/model`, `/clear`, `/stop`. Edit a user message or
Regenerate an assistant reply.

#### 8. Invite & room UX

You need others to join your compute mesh quickly. Room codes stay short. Copy
invite or show a QR code. Set a display name. Peers show owner, compute, or
request-only role badges.

#### 9. Capability dashboard

You want to know if this machine can host models. The Capabilities panel shows
WebGPU status, GPU vendor/architecture, shader-f16, estimated VRAM, compatible
model count, and mesh connectivity.

#### 10. Session telemetry strip

You want health at a glance while jobs run. The strip shows queue depth, tok/s,
median peer RTT, and shard hop count while the model warms across the pool.

#### 11. Error recovery playbook

A peer drops mid-shard or a load fails. A recovery banner explains what happened
and offers Retry load, Stop job, or Unload model.

#### 12. Onboarding tour

You open TeamThink for the first time. A short tour walks through create/join,
pick a model, invite peers, and send your first prompt.

---

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

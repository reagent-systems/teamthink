# TeamThink Major Update Roadmap

A 100-feature product plan for evolving TeamThink from a serverless WebGPU
peer mesh into a full distributed AI platform: local-first inference (inspired
by [LM Studio](https://lmstudio.ai)), live-web agent context (inspired by
[Firecrawl](https://www.firecrawl.dev)), and managed realtime / identity /
persistence primitives (inspired by [Firebase](https://firebase.google.com)).

Also informed by adjacent systems: [Petals](https://github.com/bigscience-workshop/petals)
(swarm sharding), [WebLLM](https://github.com/mlc-ai/web-llm) / MLC,
[Open WebUI](https://github.com/open-webui/open-webui), Ollama, and AnythingLLM.

Status legend: `[ ]` planned · `[~]` experimental / partial today · `[x]` shipped

---

## North star

Spin up a session, invite peers, and run models larger than any single device —
with ChatGPT-class UX, OpenAI-compatible APIs, document + web RAG, MCP tools,
identity, and optional managed backends — while keeping the core path
browser-native and serverless.

---

## Phase 0 — Foundations & polish (1–12)

Ship the product people expect when they open a local / mesh AI app.

1. `[x]` **Multi-turn chat threads** — persistent conversation history per room with rename, pin, archive, and export (JSON / Markdown / HTML).
2. `[x]` **System prompts & presets** — reusable prompt library with temperature / top-p / max-tokens defaults (LM Studio-style configs).
3. `[x]` **Sampler control panel** — temperature, top-p, top-k, repetition penalty, presence/frequency penalty, stop sequences, seed.
4. `[x]` **Structured / JSON output mode** — constrained decoding or schema-guided generation for agent pipelines.
5. `[x]` **Streaming UX upgrades** — token-level markdown rendering, code blocks with copy, thinking/reasoning collapse for CoT models.
6. `[x]` **Model load / unload lifecycle UI** — progress, cancel, VRAM meter, “keep warm” vs “evict on idle” policies.
7. `[x]` **Keyboard-first chat** — Cmd/Ctrl+Enter send, slash commands (`/model`, `/clear`, `/stop`), message edit & regenerate.
8. `[x]` **Invite & room UX** — short room codes, QR join, guest display names, role badges (owner / compute / request-only).
9. `[x]` **Capability dashboard** — WebGPU adapter info, shader-f16, estimated VRAM, CPU fallback badge, NAT/TURN status.
10. `[x]` **Session telemetry strip** — tokens/sec, queue depth, peer RTT, shard hop latency (Petals-style health at a glance).
11. `[x]` **Error recovery playbook** — auto-retry failed claims, stale-task reclaim UX, clear “peer left mid-shard” messaging.
12. `[x]` **Onboarding tour** — first-run flow: create room → invite peer → pick model → first completion.

---

## Phase 1 — LM Studio–class local model experience (13–28)

Bring desktop local-LLM polish into the browser mesh.

13. `[x]` **In-app Hugging Face model browser** — search, filter by size/modality/quant, one-click add to registry.
14. `[x]` **Custom model import** — paste any MLC / Transformers.js / HF repo id; validate WebGPU compatibility before load.
15. `[x]` **GGUF / llama.cpp WASM path** — optional engine for broader CPU/GPU coverage beyond WebLLM quants.
16. `[x]` **Quantization picker** — q4 / q5 / q8 / f16 variants with VRAM fit estimator across the pool.
17. `[x]` **Embeddings engine** — first-class embedding models for RAG and semantic search (OpenAI `/v1/embeddings` shape).
18. `[x]` **Vision & multimodal chat** — image attach, PDF page vision, multi-image turns (beyond SmolVLM demo).
19. `[x]` **Audio I/O** — Whisper-class STT + browser TTS / Kokoro-style local voice for hands-free mesh chat.
20. `[x]` **Document RAG (offline-capable)** — upload PDF/DOCX/MD/TXT, chunk, embed on-device, cite sources in answers.
21. `[x]` **Hybrid BM25 + vector retrieval** — Open WebUI–style hybrid search with optional re-ranker model.
22. `[x]` **MCP client** — connect Model Context Protocol servers from the session; expose tools to the active model.
23. `[x]` **Tool / function calling** — OpenAI-style `tools` + parallel tool calls routed through the mesh scheduler.
24. `[x]` **OpenAI-compatible local gateway** — `/v1/chat/completions`, `/v1/completions`, `/v1/models`, `/v1/embeddings` served from a peer or Worker proxy.
25. `[x]` **Anthropic-compatible Messages API** — drop-in for Claude-shaped clients pointing at the mesh.
26. `[x]` **Headless node / daemon mode** — “llmster for browsers”: keep a tab or Service Worker as always-on compute without full UI.
27. `[x]` **CLI (`tt`)** — create rooms, list peers, pull models, chat, and start a local OpenAI server from the terminal.
28. `[x]` **TypeScript + Python SDKs** — script the mesh: load model, stream chat, submit pipeline jobs, manage rooms.

---

## Phase 2 — Firecrawl-class web context & agents (29–44)

Give the mesh live-web eyes and hands so agents can search, scrape, and act.

29. `[x]` **Web scrape tool** — URL → clean Markdown / HTML / links for RAG injection (Firecrawl `/scrape` semantics).
30. `[x]` **Site crawl tool** — depth/limit crawl of a domain into a session knowledge base.
31. `[x]` **Site map discovery** — fast URL inventory before selective scrape.
32. `[x]` **Web search + content** — query → ranked results with full-page Markdown in one call.
33. `[x]` **News / image search sources** — specialized search result types for agents.
34. `[x]` **Browser interact tool** — click, type, scroll, wait on JS-heavy pages (Firecrawl Interact / agent browser).
35. `[x]` **PDF & document URL parse** — remote PDFs/DOCX → Markdown without manual download.
36. `[x]` **Structured JSON extract** — schema-guided page extraction for agents and ETL.
37. `[x]` **Batch scrape queue** — async scrape of many URLs with progress in the room CRDT.
38. `[x]` **Change tracking** — watch URLs; notify room when content diffs (Firecrawl change-tracking pattern).
39. `[x]` **PII redaction pipeline** — optional scrub of scraped content before it enters chat/RAG.
40. `[x]` **Agent mode** — natural-language goal → search/crawl/scrape/reason loop with citations.
41. `[x]` **Firecrawl provider adapter** — optional hosted Firecrawl API key; same tool interface as self-hosted/browser path.
42. `[x]` **Self-hosted crawler worker** — Cloudflare Worker / container that runs crawl jobs so browsers aren’t blocked by CORS.
43. `[x]` **Knowledge base workspaces** — AnythingLLM-style collections shared across a pool (docs + crawled pages).
44. `[x]` **Citation UI** — inline footnotes linking back to scraped URLs, PDF pages, and local uploads.

---

## Phase 3 — Firebase-class identity, persistence & platform (45–60)

Add the managed-platform layer without abandoning the static-site core.

45. `[ ]` **Authentication** — email magic link, Google/GitHub OAuth, anonymous guest → upgrade (Firebase Auth pattern).
46. `[ ]` **RBAC for rooms** — owner / admin / member / viewer; compute-donor vs requester permissions.
47. `[ ]` **Persistent room state** — optional Firestore / Durable Object snapshot so late joiners and reloads restore chat + tasks.
48. `[ ]` **Realtime presence sync** — server-backed presence mirror for clients that can’t hold a full mesh.
49. `[ ]` **Offline-first cache** — Cache API / IndexedDB for models, RAG chunks, and last-known Yjs snapshot; sync on reconnect.
50. `[ ]` **Cloud Storage for artifacts** — optional uploads for large docs, images, export bundles (Firebase Storage shape).
51. `[ ]` **Remote Config** — server-driven model allowlists, feature flags, default samplers without redeploying the static site.
52. `[ ]` **App Check / abuse protection** — attest clients before they can create rooms or hit the OpenAI gateway.
53. `[ ]` **Cloud Functions / Worker triggers** — on room create, model provision, scrape complete, quota exceeded.
54. `[ ]` **Per-user rate limits & quotas** — tokens, scrape credits, room concurrency (Firebase AI Logic–style limits).
55. `[ ]` **User profiles & API keys** — personal OpenAI-gateway keys, usage dashboard, revoke/rotate.
56. `[ ]` **Team / org workspaces** — shared pools, billing seat model, SSO (SAML / OIDC) for enterprises.
57. `[ ]` **Audit logging** — admin activity + inference access logs exportable to SIEM.
58. `[ ]` **Push / email notifications** — room invite, job done, peer needed for shard, crawl finished.
59. `[ ]` **Hybrid on-device + cloud fallback** — try mesh/WebGPU first; fall back to a cloud model provider when pool is cold (Firebase AI Logic hybrid pattern).
60. `[ ]` **Admin console** — manage pools, models, users, Remote Config, and abuse reports.

---

## Phase 4 — Mesh, scheduling & Petals-grade distribution (61–76)

Scale beyond full-mesh toy rooms into a real inference swarm.

61. `[~]` **Production pipeline / tensor sharding** — graduate experimental layer sharding; stabilize multi-peer decode.
62. `[ ]` **Partial-mesh / gossip topology** — replace full mesh for 50+ peers (as noted in current limits).
63. `[ ]` **DHT / swarm discovery** — public model swarms discoverable like Petals health pages.
64. `[ ]` **Latency-aware routing** — prefer low-RTT shard neighbors; geographic / AS hints.
65. `[ ]` **Speculative decoding across peers** — draft model on one node, verify on another.
66. `[ ]` **Continuous batching** — multiplex requests on a warm node (vLLM-style) inside WebGPU constraints.
67. `[ ]` **Prefix / KV-cache sharing** — share system-prompt prefixes across jobs on the same node.
68. `[ ]` **Priority & fair queues** — QoS classes for owners vs guests; anti-starvation.
69. `[ ]` **Compute contribution scoring** — reputation for uptime, tokens served, shard reliability.
70. `[ ]` **Incentive / credit ledger (optional)** — earn credits for donating GPU; spend to run large jobs.
71. `[~]` **Native helper app** — Electron desktop shell (`desktop/`) with WebGPU flags + pack/release workflow; Tauri/daemon still open.
72. `[ ]` **LM Link–style device routing** — pin jobs to “this MacBook” vs “office tower” preferred machines.
73. `[ ]` **TURN / ICE automation** — managed TURN credentials (time-limited) issued by the signaling Worker.
74. `[ ]` **Encrypted data channels** — E2E room keys so signaling relay never sees prompts/tokens in plaintext.
75. `[ ]` **Byzantine / malicious peer guards** — checksum activations, redundant shard verify, peer quarantine.
76. `[ ]` **Swarm health monitor** — public page: models hosted, layer coverage, capacity, median tok/s (Petals health.dev).

---

## Phase 5 — Developer platform & integrations (77–88)

Make TeamThink a backend other apps build on.

77. `[ ]` **OpenAPI + MCP server export** — expose the mesh itself as an MCP server for Cursor / Claude / IDEs.
78. `[ ]` **Webhooks** — job.completed, peer.joined, crawl.finished events to external URLs.
79. `[ ]` **Zapier / n8n / Make connectors** — no-code automation against rooms and the OpenAI gateway.
80. `[ ]` **VS Code / JetBrains plugins** — complete / chat / explain using a TeamThink pool.
81. `[ ]` **Slack / Discord bots** — `@teamthink` in a channel backed by a linked room.
82. `[ ]` **Browser extension** — highlight page → summarize/ask via your mesh; donate idle tab compute.
83. `[ ]` **iframe / embed SDK** — drop-in chat widget backed by a pool for docs sites.
84. `[ ]` **Evaluation harness** — run MMLU/HumanEval-style suites across models/peers; publish scorecards.
85. `[ ]` **Observability** — OpenTelemetry traces for claim → shard hops → tokens; Prometheus metrics endpoint.
86. `[ ]` **Plugin marketplace** — community engines, tools, RAG connectors, UI themes (Open WebUI Functions analogue).
87. `[ ]` **Fine-tune / adapter hub** — LoRA / prompt-tune adapters shared on a model hub (Petals PEFT pattern).
88. `[ ]` **Dataset & eval sharing** — upload golden prompts; regression-test mesh releases.

---

## Phase 6 — Enterprise, compliance & go-to-market (89–100)

Hardening and packaging for real orgs.

89. `[ ]` **Self-host omnibus** — one Docker Compose / Helm chart: static app + signaling Worker equiv + crawler + gateway.
90. `[ ]` **Air-gapped mode** — local model mirror, no HF CDN; offline weight packs.
91. `[ ]` **SSO + SCIM** — enterprise identity lifecycle.
92. `[ ]` **Data residency controls** — pin persistence region; “mesh-only, never persist prompts” org policy.
93. `[ ]` **Compliance packs** — SOC2-oriented audit exports, retention policies, DPA templates.
94. `[ ]` **Mobile PWA** — installable app; request-only on iOS, compute where WebGPU exists.
95. `[ ]` **Billing & usage metering** — Stripe-metered tokens, scrape credits, reserved pool capacity.
96. `[ ]` **SLA for managed signaling** — uptime targets, status page, incident comms.
97. `[ ]` **Security review program** — bug bounty, threat model doc, dependency SBOM in CI.
98. `[ ]` **i18n** — UI + docs in major languages; RTL support.
99. `[ ]` **Accessibility (WCAG 2.2 AA)** — keyboard, contrast, screen-reader labels across session UI.
100. `[ ]` **Public changelog & versioning** — semver for app, Worker, SDK, and gateway; migration guides per major.

---

## Suggested sequencing

| Wave | Features | Theme |
|------|----------|--------|
| **A** | 1–12, 13–16, 6, 9–11 | Chat polish + model browser |
| **B** | 17–23, 20–21, 29–32, 40, 44 | RAG + MCP + web scrape/search |
| **C** | 24–28, 77, 85 | OpenAI gateway, CLI, SDKs |
| **D** | 45–55, 47–49, 52 | Auth, persistence, App Check |
| **E** | 61–68, 73–76 | Shard productionization + topology |
| **F** | 33–39, 41–43, 56–60 | Full Firecrawl suite + orgs |
| **G** | 69–72, 78–88, 89–100 | Incentives, integrations, enterprise |

---

## Design constraints (non-negotiable)

- **Static-first:** the page remains hostable on any CDN; optional managed services are adapters, not hard dependencies.
- **Browser compute stays first-class:** WebGPU peers are the product; cloud fallback is additive.
- **No fake privacy copy in UI:** document security in docs / policy pages, not reassurance subtitles under controls.
- **Pluggable engines:** WebLLM, Transformers.js, GGUF/WASM, sharded WebGPU, and future backends share `InferenceEngine`.
- **Tools are providers:** Firecrawl-hosted, self-hosted crawler, or browser-side fetch implement the same tool interface.

---

## Inspiration map

| Source | What we borrow |
|--------|----------------|
| **LM Studio** | Model browser, RAG, MCP, OpenAI/Anthropic APIs, CLI, headless daemon, SDKs, device routing (LM Link) |
| **Firecrawl** | Scrape / crawl / map / search / interact / agent / batch / change-tracking / structured extract |
| **Firebase** | Auth, RBAC, realtime + offline persistence, Storage, Remote Config, App Check, Functions, hybrid on-device/cloud AI |
| **Petals** | Swarm health, layer hosting, PEFT adapters, latency-aware chains |
| **Open WebUI / AnythingLLM** | Multi-user chat, hybrid RAG, workspaces, plugins/functions |
| **WebLLM / MLC** | In-browser engines, WebWorker isolation, progressive weight load |

---

## Tracking

Open issues or PRs against this file by feature number (e.g. `feat(#24): OpenAI gateway`).
Update the checkbox when a feature lands on `main`.

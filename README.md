# TeamThink — Serverless WebGPU Inference Grid

Spin up a session, share an invite link, and run model inference across a
peer-to-peer mesh of browsers. Each device that joins becomes a WebGPU compute
node; inference requests are routed to whichever peer has capacity.

The page itself is a **fully static site** (host it on Vercel, Cloudflare Pages,
or any CDN). All realtime coordination lives on a small **Cloudflare Worker +
Durable Object** (`worker/`): peers hold one WebSocket to the room's DO, which
relays the WebRTC handshake and pushes presence. It's genuine pub/sub — no
polling — and disconnects are detected natively from the socket closing. Model
weights are fetched directly from the Hugging Face CDN. Nothing of ours sits in
the data path.

## Architecture

- **Signaling + presence (Cloudflare DO, pub/sub, no polling):** each peer opens
  a single WebSocket to the room's Durable Object. The DO relays the SDP/ICE
  handshake and emits `join`/`leave` events the instant a socket opens or closes
  — so peer discovery and disconnect detection are event-driven, never polled.
  Sockets use the Hibernation API, so idle connections cost ~nothing. A
  deterministic id tie-break means exactly one side of each pair offers, and the
  room converges to a full mesh.
- **Pool registry:** the DO keeps a live directory of pools (updated on
  membership change, with a stale-entry backstop). The landing page lists active
  pools so a visitor can join one or start their own.
- **Data plane (peer-to-peer):** a [Yjs](https://github.com/yjs/yjs) document is
  replicated across peers over WebRTC data channels. Presence/capability
  heartbeats are gossiped; a shared task map drives scheduling. Tokens stream
  directly from the runner to the requester. Late joiners sync the document from
  any connected peer (no server-persisted snapshot).
- **Weights:** range-fetched straight from the Hugging Face CDN by each browser.
- **Inference:** runs in a Web Worker behind a pluggable engine interface —
  [WebLLM](https://github.com/mlc-ai/web-llm) (chat LLMs) and
  [Transformers.js](https://github.com/huggingface/transformers.js) (vision and
  more). VRAM-pooling / model sharding implements the same interface.

```
Browser A ─┐   Cloudflare Worker + DO   ┌─ Browser B
           ├── WebSocket: presence +    ┤    (WebGPU compute)
Browser C ─┘   SDP/ICE handshake relay  └─ Browser D
     │                                          │
     └────── WebRTC data channels: Yjs CRDT + token streams ──────┘
```

## Requirements

- Node 20+, [pnpm](https://pnpm.io) 9+.
- A WebGPU-capable browser (recent Chrome/Edge) to act as a compute node.
  Browsers without WebGPU join as request-only nodes.

## Develop

```bash
pnpm install
pnpm dev
```

Open the app, click **Create session**, then open the invite link in a second
browser/tab/device to join the mesh.

## Configure

The page needs to know where the signaling Worker lives:

- `NEXT_PUBLIC_SIGNAL_WS_URL` — the deployed Worker's WebSocket origin, e.g.
  `wss://teamthink-signal.<account>.workers.dev`. The pool-registry URL
  (`/pools`) is derived from it. If unset, the page builds fine but the mesh
  can't connect.
- `NEXT_PUBLIC_TURN_URL` / `NEXT_PUBLIC_TURN_USERNAME` /
  `NEXT_PUBLIC_TURN_CREDENTIAL` — optional TURN relay for restrictive NATs.

## Deploy

**1. Signaling Worker (Cloudflare):**

```bash
cd worker
npm install
npx wrangler deploy        # first run also creates the Durable Objects
```

This needs a Cloudflare account; SQLite-backed Durable Objects are free-tier
eligible, so no KV namespace setup is required. Note the deployed URL.

**2. Static page (Vercel / Cloudflare Pages / any CDN):**

Set `NEXT_PUBLIC_SIGNAL_WS_URL` to the Worker's `wss://…` URL, then deploy.
`pnpm build` emits a static site to `out/` (`output: "export"`) — no serverless
functions, no proxied bandwidth.

## Project layout

```
app/
  page.tsx              landing: create / join / list live pools
  s/page.tsx            session route (room id from ?r=)
components/
  ui/                   Claude-style primitives (Button, Card, Badge, Stat)
  grid/                 session UI (peers, node panel, console, pool list)
lib/
  config.ts             ICE servers, signaling Worker URL, model registry
  mesh/peer.ts          WebRTC full-mesh over WebSocket signaling
  mesh/ws-signaling.ts  WebSocket client to the signaling Worker
  mesh/yjs-provider.ts  minimal Yjs sync over data channels
  grid/capabilities.ts  WebGPU/VRAM detection
  grid/scheduler.ts     decentralized task claiming + streaming
  engine/               InferenceEngine interface + WebLLM/Transformers engines
workers/
  inference.worker.ts   runs the active engine off the main thread
worker/
  src/index.ts          Cloudflare Worker: RoomDO (signaling+presence), RegistryDO
  wrangler.toml         Worker + Durable Object config
```

## Notes & limits

- Full mesh suits tens of peers; larger grids need a partial-mesh/gossip
  topology.
- Routing distributes whole requests across devices. Pooling VRAM to run a model
  larger than any single device (pipeline/tensor sharding) is experimental and
  latency-bound; it is intentionally deferred behind the engine interface.

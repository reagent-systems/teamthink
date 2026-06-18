# TeamThink — Server-Minimized WebGPU Inference Grid

Spin up a session, share an invite link, and run model inference across a
peer-to-peer mesh of browsers. Each device that joins becomes a WebGPU compute
node; inference requests are routed to whichever peer has capacity.

## Architecture

- **Control-plane bootstrap (only server piece):** Vercel KV / Upstash Redis as
  a TTL'd signaling mailbox + room registry, reached through serverless API
  routes (`/api/room`, `/api/signal`) via short-polling. Carries WebRTC SDP/ICE
  only.
- **Data plane (peer-to-peer):** a [Yjs](https://github.com/yjs/yjs) document is
  replicated across peers over WebRTC data channels. Presence/capability
  heartbeats are gossiped; a shared task map drives scheduling. Tokens stream
  directly from the runner to the requester.
- **Inference:** runs in a Web Worker behind a pluggable engine interface —
  [WebLLM](https://github.com/mlc-ai/web-llm) (chat LLMs) and
  [Transformers.js](https://github.com/huggingface/transformers.js) (vision and
  more). Phase B (VRAM-pooling / model sharding) implements the same interface.

```
Browser A ─┐                         ┌─ Browser B
           ├── /api/signal (KV) ─────┤    (WebGPU compute)
Browser C ─┘   SDP/ICE handshake     └─ Browser D
     │                                       │
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
browser/tab/device to join the mesh. Without KV credentials, a single-process
in-memory signaling store is used (sufficient for same-machine testing).

## Configure

Copy `.env.example` to `.env.local` and fill in the Upstash/Vercel KV
credentials (see comments). Optional TURN relay variables are also documented
there.

## Deploy to Vercel

1. Import the repo into Vercel (framework auto-detected as Next.js, pnpm via the
   committed `pnpm-lock.yaml`).
2. Add the **Upstash Redis** (or Vercel KV) marketplace integration — it injects
   the REST URL/token used by the signaling store.
3. Deploy. The build runs `next build --webpack` (pinned for the inference
   worker + ML package bundling).

## Project layout

```
app/
  page.tsx              landing: create / join a session
  s/[roomId]/page.tsx   session route
  api/room/route.ts     mint room ids / presence count
  api/signal/route.ts   signaling mailbox + snapshot persistence
components/
  ui/                   Claude-style primitives (Button, Card, Badge, Stat)
  grid/                 session UI (peers, node panel, inference console)
lib/
  config.ts             ICE servers, TTLs, model registry
  mesh/peer.ts          WebRTC full-mesh over KV signaling
  mesh/yjs-provider.ts  minimal Yjs sync over data channels
  grid/capabilities.ts  WebGPU/VRAM detection
  grid/scheduler.ts     decentralized task claiming + streaming
  engine/               InferenceEngine interface + WebLLM/Transformers engines
workers/
  inference.worker.ts   runs the active engine off the main thread
```

## Notes & limits

- Full mesh suits tens of peers; larger grids need a partial-mesh/gossip
  topology.
- Routing distributes whole requests across devices. Pooling VRAM to run a model
  larger than any single device (pipeline/tensor sharding) is experimental and
  latency-bound; it is intentionally deferred behind the engine interface.

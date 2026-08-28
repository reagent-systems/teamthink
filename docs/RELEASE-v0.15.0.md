# TeamThink v0.15.0 — Full Platform Release

**100-feature roadmap complete.** Download the desktop app, join a P2P WebGPU mesh, and build on the OpenAI-compatible gateway.

## Highlights

### Desktop + mesh
- **Downloadable Electron app** — `pnpm desktop:pack` → AppImage, deb, tar.gz
- **Partial-mesh topology** — scale to large rooms with encrypted data channels
- **Hybrid cloud fallback** when the pool is cold

### Developer platform (v0.14)
- **OpenAPI** — `/openapi.yaml` + `/openapi.json`
- **MCP server export** — `/mcp` for Cursor / Claude Desktop
- **Webhooks** — job.completed, peer.joined, crawl.finished
- **Embed SDK** — iframe widget for docs sites
- **Observability** — Prometheus `/metrics`, trace spans

### Enterprise (v0.15)
- **Self-host** — `deploy/docker-compose.yml` + Helm chart
- **PWA** — installable web app
- **SSO / SCIM / compliance** — Platform DO APIs
- **i18n** — en, es, de, ja

## Install

```bash
chmod +x TeamThink-0.15.0.AppImage && ./TeamThink-0.15.0.AppImage
```

Or build locally: `pnpm install && pnpm desktop:pack`

## Gateway

Local OpenAI-compatible API at `http://127.0.0.1:11434` when the desktop app is running.

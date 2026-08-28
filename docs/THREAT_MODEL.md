# TeamThink threat model (ROADMAP #97)

## Assets

- User prompts and model outputs (P2P mesh, optionally persisted in Platform DO)
- Room encryption keys (`?k=` query param, localStorage)
- API keys and auth tokens
- Webhook URLs and secrets

## Trust boundaries

1. **Browser peers** — WebRTC data channels; encrypted when room key is shared
2. **Signaling Worker** — sees room/peer ids and SDP; not prompt content on encrypted channels
3. **Platform DO** — auth, room state, webhooks; requires Bearer token
4. **Desktop gateway** — localhost :11434; optional API key

## Primary risks

| Risk | Mitigation |
|------|------------|
| Signaling abuse | App Check, rate limits, quotas |
| Malicious peer | Pipe frame checksums, peer quarantine (future) |
| Token theft | Short-lived JWT, HTTPS only in production |
| Webhook SSRF | URL validation on subscribe (future hardening) |

## Dependency supply chain

SBOM generated in CI (`.github/workflows/sbom.yml`). Report issues via GitHub Security Advisories.

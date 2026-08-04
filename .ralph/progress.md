# Ralph progress — Phase 0 + desktop

## 2026-08-04

- Initialized Ralph loop (max 12 iterations, promise `FEATURES_1_5_AND_DESKTOP_RELEASE_READY`).
- **Story 1** ✓ Multi-turn chat threads — localStorage, rename/pin/archive, export JSON/MD/HTML, multi-turn history to grid.
- **Story 2** ✓ System prompts & presets — builtin + custom save/delete; sampler defaults applied.
- **Story 3** ✓ Sampler panel — wired into `runPrompt` → GenOptions → worker; stop-sequence trim.
- **Story 4** ✓ JSON mode + optional schema; pretty-print on done.
- **Story 5** ✓ Streaming markdown, code copy, collapsible thinking.
- **Story 6** ✓ Electron desktop — WebGPU flags, static export server, `pnpm desktop:pack`, release workflow.

### Verification

- `pnpm lint` / `tsc --noEmit` / `pnpm build` clean
- `electron-builder --linux AppImage tar.gz` produced:
  - `desktop/release/TeamThink-0.2.0.AppImage`
  - `desktop/release/teamthink-desktop-0.2.0.tar.gz`

Promise ready: `FEATURES_1_5_AND_DESKTOP_RELEASE_READY`

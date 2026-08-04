---
iteration: 6
max_iterations: 12
completion_promise: "FEATURES_1_5_AND_DESKTOP_RELEASE_READY"
---

Implement ROADMAP Phase 0 features 1–5 and ship a downloadable desktop app
(Electron) because browser WebGPU is limited. Work one atomic story per
iteration. Read `.ralph/prd.json` for the next incomplete story, implement it,
run lint/typecheck as available, commit, mark `passes: true`, append to
`.ralph/progress.md`.

All six stories now pass:
1–5 Phase 0 chat UX
6 Electron desktop + pack + release workflow

Linux artifacts built: TeamThink-0.2.0.AppImage, teamthink-desktop-0.2.0.tar.gz
GitHub Release is created by CI on `v*` tags (`.github/workflows/release-desktop.yml`).

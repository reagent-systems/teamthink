# TeamThink Desktop

Downloadable Electron shell for TeamThink. Browser WebGPU support is uneven;
the desktop build enables Chromium WebGPU flags and packages the static Next
export for offline-friendly local use.

## Develop

From the repo root (with `pnpm dev` already serving the app):

```bash
pnpm desktop:install
pnpm desktop:dev
```

## Package

```bash
pnpm desktop:pack
```

Artifacts land in `desktop/release/` (AppImage, deb, tar.gz on Linux).

## Release

Push a version tag (`v0.2.0`). GitHub Actions
(`.github/workflows/release-desktop.yml`) builds Linux / macOS / Windows
installers and attaches them to the GitHub Release.

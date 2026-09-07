# Metria Win/Linux

*A Windows and Linux desktop app that tracks your AI coding assistant usage in real time.*

<p align="center">
  <img src="https://i.imgur.com/shpAcSm.gif" alt="Metria demo" width="720" />
</p>

<p align="center">
  <a href="https://github.com/yurirxmos/metria-win-linux/stargazers"><img src="https://img.shields.io/github/stars/yurirxmos/metria-win-linux?style=flat-square" alt="Stars" /></a>
  <a href="https://github.com/yurirxmos/metria-win-linux/releases"><img src="https://img.shields.io/github/v/tag/yurirxmos/metria-win-linux?label=version&style=flat-square" alt="Version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" /></a>
  <a href="https://github.com/yurirxmos/metria-win-linux/commits"><img src="https://img.shields.io/github/commit-activity/m/yurirxmos/metria-win-linux?style=flat-square" alt="Commits" /></a>
</p>

## Contents

- [What it does](#what-it-does)
- [Download](#download)
- [To do](#to-do)
- [Providers](#providers)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Project layout](#project-layout)
- [Contributing](#contributing)
- [License](#license)

## What it does

Metria shows current session and monthly usage percentages for supported AI providers.

- **Usage widget**: a right-edge widget for provider usage cards.
- **System tray**: compact access to provider usage and controls.
- **Dashboard window**: detailed per-provider cards and usage gauges.

The app stores its settings in its own `com.metria.electron` application-data namespace.

## Download

Download the installer for your operating system from the [GitHub Releases](https://github.com/yurirxmos/metria-win-linux/releases) page.

- **Windows**: `.exe` installer.
- **Linux**: `.AppImage` package.

Electron releases are unsigned. Windows SmartScreen may display a warning during installation.

## To do

- Improve Metria compatibility and runtime support for Windows and Linux.
- Add usage-aware sounds and animations.

## Providers

Providers are enabled automatically when their local credentials or usage files are detected. Providers that are not installed remain available in Settings with setup guidance.

- **Claude**: credentials read from `~/.claude/.credentials.json` on Unix and from the equivalent host or WSL location on Windows.
- **Codex**: credentials and the newest session read from `CODEX_HOME`/`~/.codex`, including WSL locations on Windows.
- **OpenCode Go**: credentials read from `XDG_DATA_HOME`/`~/.local/share/opencode/auth.json` on Unix, `%APPDATA%` on Windows, or the WSL path.
- **Antigravity**: no credential is read at all: usage comes from running the installed `agy` CLI (`agy -p "/usage"`) and parsing its four reported windows (5-hour/weekly × Gemini/other models), on the host or inside a WSL distro. The CLI authenticates itself, so Metria never reads a credential for it. Requires the Antigravity CLI; the `/usage` output format is not published by Google and can change without notice, outside this project's control.

Providers are discovered on the host filesystem and, on Windows, in installed WSL distributions. These read-only locations are fixture-tested, not runtime-tested on every supported platform.

Credentials are never committed. Metria reads them at runtime from the documented local sources.

## Mobile PWA

This version does not include phone pairing, the local PWA server, QR pairing, or mobile alerts. Those features belong to the native macOS application.

## Requirements

- Windows or Linux for the supported desktop application.
- Node.js 22.x and npm for building from source. Node 24 currently breaks `npm install`'s Electron download step (its bundled `extract-zip` silently fails to unpack the binary) — use Node 22 until that's fixed upstream.
- Windows and Linux builds must be created and runtime-tested on their respective platforms.

## Quick start

Download the latest installer from [GitHub Releases](https://github.com/yurirxmos/metria-win-linux/releases), or build it on Windows or Linux:

```sh
npm ci
npm run package
```

The host-native installer is created in `release/`.

### Run in development

```sh
npm ci
npm run dev
```

Run the checks with:

```sh
npm run check
```

Push an `electron-v*` tag to package and publish a release:

```sh
git tag electron-v0.2.0
git push origin electron-v0.2.0
```

The updater uses the dedicated `electron-latest` channel in this repository.

## Project layout

- `src/main/`: provider files, network calls, settings, tray, windows, and IPC.
- `src/preload/`: the typed `window.metria` context bridge.
- `src/renderer/`: sandboxed React dashboard, widget, and usage card.
- `src/shared/`: shared TypeScript types and provider presentation helpers.
- `src/test/`: provider, path, and WSL fixture tests.
- `resources/`: Electron icons and bundled provider assets.
- `.github/workflows/electron-release.yml`: Windows/Linux release automation.

## Architecture and security

- Browser windows use `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- The renderer has no Node or Electron imports.
- The preload exposes only typed, allowlisted `window.metria` methods.
- Every IPC method validates its sender and arguments.
- The app uses local packaged content and does not share storage with the native macOS app.

## Contributing

Contributions are welcome. Open an issue to report a bug or suggest a feature, or open a pull request with a focused change.

- Keep changes focused and follow the existing code style.
- Keep all repository text in en-US.
- Do not commit credentials, generated build output, or local configuration.
- Create and runtime-test Windows and Linux packages on their respective platforms.

## License

Metria is open source under MIT; see [LICENSE](LICENSE).

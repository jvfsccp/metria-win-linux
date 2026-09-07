# CLAUDE.md

Guidance for Claude Code (and any other agent) working in this repository.

## What this is

Metria Electron — the Windows/Linux desktop app that tracks AI coding assistant usage (Claude, Codex, OpenCode Go, Antigravity) in a tray icon, an edge widget, and a dashboard window. It is one of two codebases for the same product:

- `yurirxmos/metria` — the native macOS app (Swift) and the mobile PWA. **Not this repo.**
- `yurirxmos/metria-win-linux` — upstream. Electron only. No Swift, no phone pairing, no PWA server. Do not port macOS/Swift-specific concerns in here; if a feature only makes sense as a native macOS capability (Keychain, phone pairing, Sparkle updates), it does not belong in this codebase.
- `jvfsccp/metria-win-linux` — **this repo**, a fork of the upstream above, used to adapt Metria for this team's own Windows/Linux workflow.

The two repos independently implement the same product concept per-platform; they do not share code or a build system today.

## Architecture

Standard three-process Electron split, kept intentionally small (~2k lines):

- `src/main/` — the only place with Node/Electron APIs. `index.ts` owns windows (dashboard, widget, hover card), the tray, auto-updates, and every IPC handler. `providers.ts` fetches usage per provider. `settings.ts` persists `AppSettings` to `settings.json` (atomic write via temp file + rename). `wsl.ts` shells out to `wsl.exe` for WSL-hosted providers. `provider-paths.ts` computes platform-specific credential/binary paths.
- `src/preload/` — `index.ts` exposes a single typed `window.metria` object via `contextBridge`. Nothing else crosses the boundary.
- `src/renderer/` — sandboxed React, one entry per window (`index.tsx` dashboard, `widget.tsx` edge widget, `card.tsx` hover card). No Node or Electron imports here, ever.
- `src/shared/` — `types.ts` is the single source of truth for cross-process types and the few UI constants (colors, sizes, per-provider window titles) that both main and renderer need. When a value is needed on both sides, it goes here, not duplicated in each.

**Security model** (do not weaken without a very good reason): `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` on every `BrowserWindow`. Every `ipcMain.handle` starts with `requireTrustedSender(event)`, which checks the sender is one of the app's own windows. Every handler validates its arguments before using them (see the `isProviderKind`/`validProviderSource` guards in `index.ts`). New IPC methods must follow this pattern: validate the sender, validate the payload, then act.

## The provider pattern

This is the main extensibility point in the app — read it before adding or touching a provider. Each provider (`ClaudeProvider`, `CodexProvider`, `OpenCodeGoProvider`, `AntigravityProvider` in `src/main/providers.ts`) implements:

```ts
interface Provider {
  readonly kind: ProviderKind;
  readonly hint: string;
  hasHostCredentials(): boolean;
  fetchHost(): Promise<ProviderUsage>;
  fetchWsl(shell: WslShell, distro: string): Promise<ProviderUsage>;
}
```

`ProviderService.fetch()` picks host vs. a detected WSL distro per provider (`chooseSource`), always returning something rather than throwing — network/parse errors degrade to `{ available: true, error: "..." }` with the last-known windows kept on screen, and a genuinely absent provider degrades to `{ available: false, setupHint }`. A provider's fetch method should never let an exception escape uncaught; catch and return a degraded state instead. When a provider isn't file/HTTP-based (Antigravity: no credential file, it spawns the vendor CLI and parses its output), the credential-file checks become binary-presence checks, but the shape of the interface stays the same.

Adding a provider touches a known, small set of files — grep the codebase for an existing `ProviderKind` (e.g. `"Codex"` or `"Antigravity"`) to find every one of them; there is no single registry. As of this writing that's: `shared/types.ts` (`ProviderKind`, `ALL_PROVIDER_KINDS`, `PROVIDER_LOGOS`, `PROVIDER_WINDOW_TITLES`), `main/providers.ts` (the class + `POPULATION_BY_KIND` if it's WSL-capable), `main/wsl.ts` (`WslProviderPresence` + probe script, if WSL-capable), `main/index.ts` (`reconnect` handler's per-kind command), `renderer/widget.tsx` (`ACCENT` color), and `resources/assets/` + `scripts/copy-renderer-assets.cjs` (logo).

## Conventions

- **No lint/format tooling is configured** (no ESLint, no Prettier). Match the surrounding code by hand: double quotes, semicolons, 2-space indentation, dense one-line arrow functions where the file already does that (`providers.ts`, `index.ts`), more conventional multi-line React components in `renderer/`.
- **Comments are rare and short.** A one-line comment explains a non-obvious constraint or a workaround (e.g. why WSLg is excluded from `disableHardwareAcceleration`), never what the code visibly does. Don't add multi-line comment blocks or docstrings.
- **TypeScript strict mode is on.** Prefer narrowing/validation functions (`isProviderKind`, `validProviderSource`) over casts.
- Keep `main`/`preload`/`renderer` boundaries intact: if you find yourself wanting a Node API in `renderer/`, the answer is a new IPC method, not an import.
- English only in code, comments, commit messages, and docs (this mirrors the sibling macOS repo's explicit "en-US only" rule; it's not written down here elsewhere, so follow it by convention).

## Testing

`npm run check` runs, in order: `typecheck` (`tsc` for both `src/main`+shared and the renderer config), `build` (`tsc` + `vite build` + asset copy), then `test` (Node's built-in `node --test` against the **compiled** output in `dist/test/*.test.js` — tests must be built before they can run). Run this before considering any change done.

Tests live in `src/test/`, one file per main-process module (`providers.test.ts`, `provider-paths.test.ts`, `wsl.test.ts`). They test pure functions and injected-dependency shells (`makeWslShell({ exec: fakeFn })`) — no Electron runtime, no real subprocess/network calls. When adding logic worth testing, prefer extracting it into a small pure function (see `parseAntigravityWindows` in `main/antigravity.ts`) over testing something entangled with `ipcMain`/`BrowserWindow`.

There is no CI lint/test gate visible in `.github/workflows/electron-release.yml` today — that workflow only packages and publishes releases on tag push. `npm run check` is the de facto pre-merge gate; run it yourself.

## Platform requirements

- **Node 22.x, not 24.** Node 24's `extract-zip`/`yauzl` (pulled in by the `electron` package's postinstall) silently fails to unpack the Electron binary — the process exits without error or output, leaving `node_modules/electron/dist` empty. `npm install`/`npm ci` will appear to succeed and then `electron .` fails with "Electron failed to install correctly". This is enforced via `package.json`'s `engines` field and documented in the README; if you hit that exact error, it's this, not a real electron install problem — reinstall dependencies under Node 22.
- Windows and Linux only. Anything Windows-specific (autostart via `.desktop` files, WSL detection, `LOCALAPPDATA`) has a Linux equivalent nearby — check `provider-paths.ts` and the `process.platform` branches in `index.ts`/`settings.ts` before assuming one platform's behavior.
- WSL support is real, not speculative: several providers can be sourced from inside a WSL distro instead of the Windows host (`wsl.ts`, `chooseSource` in `providers.ts`). `wsl.exe` output over a pipe is UTF-16LE without a BOM on Windows and needs `decodeWslOutput`; commands run inside a distro go through `sh` via stdin, not `wsl.exe -e` with argv, so shell-script quoting rules apply.

## Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) in English, imperative mood, present tense: `type(scope): summary`. Recent history in this repo (`feat(widget): match native notch design`, `feat(card): black hover background and truncate provider account label`) is the pattern to follow; older commits predate this and are not the model to copy.

- Common types here: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`.
- Scope is usually the touched area: `widget`, `card`, `tray`, `dashboard`, `providers`, `settings`, `wsl`, `deps`, or a provider name (`antigravity`, `codex`).
- Keep the subject short (~50-70 chars) and specific about the *change*, not the *task* ("Add Antigravity provider" not "Implement Antigravity feature per plan").
- One logical change per commit where practical — a feature that touches many files for one reason is still one commit; unrelated fixes picked up along the way are separate commits.

## Branching and PRs

No branch-naming convention is established in history yet (this repo has only ever been developed on `main` directly, per `git log`). Use `type/short-kebab-description` (mirroring the commit `type`), e.g. `feat/antigravity-provider`, `fix/node24-electron-install`. Open PRs against `main` via `gh pr create`; there's no PR template in this repo.

Releases are tag-driven and separate from normal merges: pushing `electron-v*` triggers `.github/workflows/electron-release.yml`, which packages Windows/Linux installers and publishes them to GitHub Releases under both the specific tag and the rolling `electron-latest` channel (used by the in-app auto-updater). Don't push a release tag as a side effect of unrelated work.

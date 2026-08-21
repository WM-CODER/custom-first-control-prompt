# Changelog

## [0.2.3] - 2026-08-21

### Fixed
- Client bundle `__ModuleLoader__.load` registration id now matches the core package name (`@wm-coders/dsh-custom-first-control-prompt`), fixing "loaded without registering" error on plugin install

## [0.2.2] - 2026-08-21

### Changed
- Merged host and client halves into a single package: `dsh.bundle` (host patch) and `dsh.client` (browser panel auto-discovery) now live in one `package.json`, eliminating the separate `@wm-coders/dsh-client-ui-custom-first-control-prompt` package
- `cordis.patch.yml` no longer inserts a UI row — the browser panel is auto-discovered via `dsh.client`
- `./client` export now points to the browser panel entry (`lib/client.js`); typert client types moved to `./typert-client`
- `install.ps1`/`install.sh` and `uninstall.ps1`/`uninstall.sh` simplified to single-package flow
- Uninstall message now includes browser hard-refresh instruction

### Fixed
- `dsh plugin add` no longer needs a separate UI package in `dependencies` — one package, one install
- Removed `settings.plugin.item` slot registration that used `id` on a `keyed` slot (keyed slot requires options.key)
- Removed `@deepseek-ai/dsh-client-ui-settings-plugins` from client inject list and peerDependencies (no longer used)
- Fixed offline junction scope from `@wm-coder` to `@wm-coders` in install/uninstall scripts

### Removed
- `client-ui/` subdirectory (merged into the main `lib/` tree)
- `@wm-coders/dsh-client-ui-custom-first-control-prompt` npm package (merged into core)

## [0.2.1] - 2026-08-20

### Added
- `engines.node` field for plugin guide compliance
- `CHANGELOG.md` following Keep a Changelog convention

### Changed
- npm scope renamed from `@wm-coder` to `@wm-coders` (the former was already taken on npm)
- `README.md` install commands updated for both GitHub and npm installation methods

## [0.2.0] - 2026-08-19

### Changed
- C-only convergence: removed A (hook) and B (append) seed modes, keeping only C (request-path interception)
- Package names changed from `@deepseek-ai/dsh-*` to `@wm-coder/dsh-*` (later `@wm-coders` in 0.2.1)
- Bundle layer (`cordis.patch.yml`) added with self-describing sample configuration
- Panel save anti-collision fix: profile patch without core row now uses id-targeted override instead of append

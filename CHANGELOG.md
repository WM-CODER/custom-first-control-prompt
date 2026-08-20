# Changelog

## [0.2.1] - 2026-08-20

### Added
- `engines.node` field in both package.json files (`^22.19.0 || >=24.0.0`)
- CHANGELOG.md

## [0.2.0] - 2026-08-20

### Added
- C-only request-path injection via llm/stream waterfall listener
- Web panel surface: settings editor, composer dock, LLM request listener
- Bundle layer (cordis.patch.yml) with self-describing sample configuration
- Cross-platform install scripts (install/uninstall/verify/restart-web/escape)
- macOS/Linux support (.sh equivalents for all .ps1 scripts)
- Published to npm (@wm-coders scope)

### Changed
- Renamed scope from @wm-coder to @wm-coders (npm org name availability)
- Rewrote escape.ps1: removed dead A-route framework restore code
- Source code scope consistency: all src/ files now use @wm-coders

### Removed
- A-route (hook) and B-route (append) implementations
- seedMode/historyMode configuration
- Framework patch dependencies

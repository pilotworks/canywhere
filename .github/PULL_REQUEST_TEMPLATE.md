## Description

<!-- Provide a brief description of the changes introduced by this PR. Include motivation and context. -->

## Type of Change

- [ ] 🐛 Bug fix (non-breaking change fixing an issue)
- [ ] ✨ New feature (non-breaking change adding functionality)
- [ ] 💥 Breaking change (fix or feature that would break existing API/wire compatibility)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style / Refactor (formatting, naming, no functional change)
- [ ] ⚡ Performance improvement
- [ ] 🧪 Tests (adding or updating test suites)
- [ ] 🔧 Build / CI / Tooling

## Component(s) Affected

- [ ] `crates/canywhere-protocol` (Shared wire protocol & schema)
- [ ] `crates/canywhere-server` (Host daemon, adapters, SQLite, RPC)
- [ ] `packages/desktop-ui` (React 19 / Vite UI)
- [ ] `packages/desktop-app` (Tauri v2 wrapper)
- [ ] `mobile/ios` (SwiftUI iOS client)
- [ ] `docs` (Documentation / Specifications)

## Verification & Testing

<!-- Describe how these changes were tested. Include commands used (e.g. `make test`, `make check`) and steps to verify manually. -->

- [ ] Ran `make check` without errors
- [ ] Ran `make test` and all suites pass
- [ ] If protocol changed: Ran `make codegen` and verified generated TypeScript and Swift files
- [ ] Tested on Desktop
- [ ] Tested on iOS Simulator / Device (if iOS affected)

## Checklist

- [ ] My code follows the project's coding standards and architectural invariants.
- [ ] I have not manually edited generated files (`mobile/ios/Models/Generated/*`, `packages/desktop-ui/src/types/generated/*`).
- [ ] I have added/updated relevant tests.
- [ ] I have updated documentation if necessary.
- [ ] My commits follow [Conventional Commits](https://www.conventionalcommits.org/).

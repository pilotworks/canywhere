.PHONY: all build test dev codegen clean help ui-dev ui-build server desktop desktop-bundle ui-test check

ifeq ($(shell uname -s),Darwin)
BUNDLES ?= app
else
BUNDLES ?=
endif

help: ## Show help for all commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

# --- CODEGEN ---
codegen: ## Generate TypeScript types and Swift models from Rust protocol
	cargo test -p canywhere-protocol --test export_types
	bun run scripts/codegen-swift.ts

icons: ## Download official vscode-icons assets and generate theme manifest
	bun run scripts/download-vscode-icons.ts

# --- BUILD ---
ui-build: ## Build Desktop UI with Bun + Vite
	cd packages/desktop-ui && bun install && bun run build

desktop-bundle: ui-build ## Bundle Desktop application (options: BUNDLES=app,dmg or TAURI_ARGS="--debug")
	cd packages/desktop-app/src-tauri && bunx @tauri-apps/cli build $(if $(BUNDLES),--bundles $(BUNDLES),) $(TAURI_ARGS)

ios-project: codegen ## Generate iOS Xcode project via xcodegen
	cd mobile/ios && xcodegen generate

ios-build: ios-project ## Build iOS Simulator App
	xcodebuild -project mobile/ios/Canywhere.xcodeproj -scheme Canywhere -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build

build: codegen ui-build ios-build ## Build full workspace (Rust + UI + iOS)
	cargo build --workspace

# --- TESTING ---
ui-test: ## Run unit tests for Desktop UI
	cd packages/desktop-ui && bun test

test: ui-test ## Run full test suites (Rust workspace + UI)
	cargo test --workspace

# --- DEVELOPMENT RUNNERS ---
server: ## Run Canywhere Host Server Daemon
	cargo run -p canywhere-server

ui-dev: ## Run Vite dev server for Desktop UI
	cd packages/desktop-ui && bun run dev

desktop: ui-build ## Run Desktop Tauri Client
	cargo run -p canywhere-desktop

# --- LINT & TYPECHECK ---
check: ## Typecheck Desktop UI and cargo check Rust workspace
	cd packages/desktop-ui && bun run typecheck
	cargo check --workspace

# --- CLEANUP ---
clean: ## Clean cargo target and UI dist artifacts
	cargo clean
	rm -rf packages/desktop-ui/dist packages/desktop-ui/node_modules

# --- RELEASE ---
release: ## Bump version, commit, and tag (e.g. make release VERSION=0.2.0)
	@test -n "$(VERSION)" || (echo "Usage: make release VERSION=x.y.z" && exit 1)
	bun run release $(VERSION)

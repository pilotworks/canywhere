.PHONY: all build test dev codegen clean help ui-dev ui-build server desktop ui-test check

help: ## Show help for all commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

# --- CODEGEN ---
codegen: ## Generate TypeScript types and Swift models from Rust protocol
	cargo test -p canywhere-protocol --test export_types
	bun run scripts/codegen-swift.ts

# --- BUILD ---
ui-build: ## Build Desktop UI with Bun + Vite
	cd packages/desktop-ui && bun install && bun run build

build: codegen ui-build ## Build full workspace (Rust + UI)
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

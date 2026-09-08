import { initDatabase } from "./db/database.js";
import { RepositoryManager } from "./db/repositories.js";
import { CodexAdapter } from "./adapters/codex.js";
import { PairingSecurityManager } from "./security/pairing.js";
import { HostServer } from "./server.js";

export * from "./db/database.js";
export * from "./db/repositories.js";
export * from "./adapters/types.js";
export * from "./adapters/codex.js";
export * from "./security/pairing.js";
export * from "./rpc/dispatcher.js";
export * from "./server.js";

async function main() {
  const port = Number(process.env.PORT) || 7890;
  const host = process.env.HOST || "127.0.0.1";

  const db = initDatabase();
  const repo = new RepositoryManager(db);
  const pairing = new PairingSecurityManager(repo, port, host);
  const adapter = new CodexAdapter(process.env.CODEX_BIN || "codex");

  // Attempt adapter initialization
  try {
    await adapter.initialize();
    console.log("[HostServer] CodexAdapter initialized successfully");
  } catch (err: any) {
    console.warn(`[HostServer] CodexAdapter initialize warning (codex CLI may not be running): ${err.message}`);
  }

  const server = new HostServer({
    port,
    host,
    repo,
    adapter,
    pairing,
    enableBonjour: true
  });

  const address = await server.start();
  console.log(`[HostServer] Canywhere Host listening on ${address}`);
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("[HostServer] Fatal error:", err);
    process.exit(1);
  });
}

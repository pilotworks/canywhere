import http from "node:http";
import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class DaemonSupervisor {
  private child: ChildProcess | null = null;
  private port: number;

  constructor(port: number = 7890) {
    this.port = port;
  }

  async isRunning(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/health`, { timeout: 1000 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  async start(): Promise<void> {
    const alreadyUp = await this.isRunning();
    if (alreadyUp) {
      console.log(`[DaemonSupervisor] Host daemon already running on port ${this.port}`);
      return;
    }

    console.log(`[DaemonSupervisor] Spawning host daemon on port ${this.port}...`);

    // In dev or packaged build, resolve path to host-server dist or source
    const hostServerPkg = path.resolve(__dirname, "../../host-server");
    const scriptPath = path.join(hostServerPkg, "dist/index.js");

    this.child = spawn(process.execPath, [scriptPath], {
      env: {
        ...process.env,
        PORT: String(this.port),
        ELECTRON_RUN_AS_NODE: "1"
      },
      stdio: "pipe"
    });

    this.child.stdout?.on("data", (d) => console.log(`[HostDaemon] ${d.toString().trim()}`));
    this.child.stderr?.on("data", (d) => console.warn(`[HostDaemon ERR] ${d.toString().trim()}`));

    this.child.on("exit", (code) => {
      console.log(`[DaemonSupervisor] Host daemon exited with code ${code}`);
      this.child = null;
    });

    // Wait until daemon is responsive
    const maxRetries = 30;
    for (let i = 0; i < maxRetries; i++) {
      await new Promise((res) => setTimeout(res, 200));
      if (await this.isRunning()) {
        console.log(`[DaemonSupervisor] Host daemon is online and healthy`);
        return;
      }
    }

    throw new Error(`Timed out waiting for host daemon to start on port ${this.port}`);
  }

  async stop(): Promise<void> {
    if (this.child) {
      console.log("[DaemonSupervisor] Stopping host daemon...");
      this.child.kill("SIGTERM");
      this.child = null;
    }
  }
}

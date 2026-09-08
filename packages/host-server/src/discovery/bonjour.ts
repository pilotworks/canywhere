import { Bonjour, Service } from "bonjour-service";

export interface BonjourConfig {
  name?: string;
  port: number;
  hostPublicKey: string;
}

export class BonjourAdvertiser {
  private bonjour: Bonjour | null = null;
  private service: Service | null = null;

  constructor(private config: BonjourConfig) {}

  start(): void {
    this.bonjour = new Bonjour();
    this.service = this.bonjour.publish({
      name: this.config.name || "Canywhere Host",
      type: "canywhere",
      port: this.config.port,
      txt: {
        v: "1",
        hostKey: this.config.hostPublicKey
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.service) {
        this.service.stop(() => {
          if (this.bonjour) {
            this.bonjour.destroy();
          }
          resolve();
        });
      } else {
        if (this.bonjour) {
          this.bonjour.destroy();
        }
        resolve();
      }
    });
  }
}

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";
import { nanoid } from "nanoid";
import { PairingQrPayload, Device } from "@canywhere/protocol-schema";
import { RepositoryManager, PairingSessionRecord } from "../db/repositories.js";

// Configure @noble/ed25519 with sha512
ed.etc.sha512Sync = (...m: Uint8Array[]) => sha512(ed.etc.concatBytes(...m));
ed.etc.sha512Async = (...m: Uint8Array[]) => {
  const syncFn = ed.etc.sha512Sync;
  if (!syncFn) throw new Error("sha512Sync not configured");
  return Promise.resolve(syncFn(...m));
};

export class PairingSecurityManager {
  private hostPrivateKey: Uint8Array;
  private hostPublicKeyHex: string;
  private hostId: string;

  constructor(
    private repo: RepositoryManager,
    private serverPort: number,
    private serverHost: string = "127.0.0.1"
  ) {
    this.hostPrivateKey = ed.utils.randomPrivateKey();
    this.hostPublicKeyHex = Buffer.from(ed.getPublicKey(this.hostPrivateKey)).toString("hex");
    this.hostId = nanoid();
  }

  getHostId(): string {
    return this.hostId;
  }

  getHostPublicKey(): string {
    return this.hostPublicKeyHex;
  }

  createPairingSession(ttlMs: number = 300_000): { session: PairingSessionRecord; qrPayload: PairingQrPayload } {
    const token = nanoid(32);
    const secret = nanoid(32);
    const session = this.repo.createPairingSession(token, secret, ttlMs);

    const qrPayload: PairingQrPayload = {
      hostId: this.hostId,
      hostName: "Canywhere Host",
      token,
      endpoints: [`ws://${this.serverHost}:${this.serverPort}/rpc`],
      hostPublicKey: this.hostPublicKeyHex,
      expiresAt: session.expiresAt
    };

    return { session, qrPayload };
  }

  verifyPairingToken(token: string): boolean {
    return this.repo.consumePairingSession(token);
  }

  async verifyDeviceSignature(publicKeyHex: string, challenge: string, signatureHex: string): Promise<boolean> {
    try {
      const pubBytes = Buffer.from(publicKeyHex, "hex");
      const sigBytes = Buffer.from(signatureHex, "hex");
      const msgBytes = Buffer.from(challenge, "utf-8");
      return await ed.verifyAsync(sigBytes, msgBytes, pubBytes);
    } catch {
      return false;
    }
  }

  async registerPairedDevice(device: Omit<Device, "pairedAt" | "lastSeenAt">): Promise<Device> {
    return this.repo.registerDevice(device);
  }

  isDeviceAuthorized(publicKeyHex: string): boolean {
    const device = this.repo.getDeviceByPublicKey(publicKeyHex);
    if (!device) return false;
    return !device.revoked;
  }
}

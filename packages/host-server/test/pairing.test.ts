import { describe, it, expect, beforeEach } from "vitest";
import * as ed from "@noble/ed25519";
import { initDatabase } from "../src/db/database.js";
import { RepositoryManager } from "../src/db/repositories.js";
import { PairingSecurityManager } from "../src/security/pairing.js";

describe("PairingSecurityManager", () => {
  let repo: RepositoryManager;
  let pairing: PairingSecurityManager;

  beforeEach(() => {
    const db = initDatabase(":memory:");
    repo = new RepositoryManager(db);
    pairing = new PairingSecurityManager(repo, 7890);
  });

  it("should create valid QR payload and verify pairing token", () => {
    const { session, qrPayload } = pairing.createPairingSession();
    expect(qrPayload.endpoints[0]).toBe("ws://127.0.0.1:7890/rpc");
    expect(qrPayload.token).toBe(session.token);
    expect(qrPayload.hostPublicKey).toBe(pairing.getHostPublicKey());

    // Verify token can be consumed once
    expect(pairing.verifyPairingToken(session.token)).toBe(true);
    expect(pairing.verifyPairingToken(session.token)).toBe(false);
  });

  it("should verify ed25519 signatures and manage device authorization", async () => {
    const clientPrivateKey = ed.utils.randomPrivateKey();
    const clientPublicKeyBytes = ed.getPublicKey(clientPrivateKey);
    const clientPublicKeyHex = Buffer.from(clientPublicKeyBytes).toString("hex");

    const challenge = "canywhere-auth-challenge-12345";
    const msgBytes = Buffer.from(challenge, "utf-8");
    const signatureBytes = await ed.signAsync(msgBytes, clientPrivateKey);
    const signatureHex = Buffer.from(signatureBytes).toString("hex");

    const isValid = await pairing.verifyDeviceSignature(clientPublicKeyHex, challenge, signatureHex);
    expect(isValid).toBe(true);

    await pairing.registerPairedDevice({
      id: "client-dev-1",
      publicKey: clientPublicKeyHex,
      name: "Tien's iPhone",
      platform: "ios",
      lastTransport: "lan",
      revoked: false
    });

    expect(pairing.isDeviceAuthorized(clientPublicKeyHex)).toBe(true);

    repo.revokeDevice("client-dev-1");
    expect(pairing.isDeviceAuthorized(clientPublicKeyHex)).toBe(false);
  });
});

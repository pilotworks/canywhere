import { Type, type Static } from "@sinclair/typebox";

export const DevicePlatformSchema = Type.Union(
  [Type.Literal("ios"), Type.Literal("desktop")],
  { $id: "DevicePlatform" }
);
export type DevicePlatform = Static<typeof DevicePlatformSchema>;

export const DeviceTransportSchema = Type.Union(
  [Type.Literal("lan"), Type.Literal("tailscale")],
  { $id: "DeviceTransport" }
);
export type DeviceTransport = Static<typeof DeviceTransportSchema>;

export const DeviceSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    platform: DevicePlatformSchema,
    publicKey: Type.String(),
    pairedAt: Type.Integer(),
    lastSeenAt: Type.Integer(),
    lastTransport: DeviceTransportSchema,
    revoked: Type.Boolean(),
  },
  { $id: "Device" }
);
export type Device = Static<typeof DeviceSchema>;

export const PairingQrPayloadSchema = Type.Object(
  {
    hostId: Type.String(),
    hostName: Type.String(),
    token: Type.String(),
    endpoints: Type.Array(Type.String()),
    hostPublicKey: Type.String(),
    expiresAt: Type.Integer(),
  },
  { $id: "PairingQrPayload" }
);
export type PairingQrPayload = Static<typeof PairingQrPayloadSchema>;

export const PairingRequestSchema = Type.Object(
  {
    token: Type.String(),
    deviceId: Type.String(),
    deviceName: Type.String(),
    devicePublicKey: Type.String(),
    platform: DevicePlatformSchema,
  },
  { $id: "PairingRequest" }
);
export type PairingRequest = Static<typeof PairingRequestSchema>;

export const PairingResponseSchema = Type.Object(
  {
    status: Type.Literal("paired"),
    hostId: Type.String(),
    authToken: Type.String(),
  },
  { $id: "PairingResponse" }
);
export type PairingResponse = Static<typeof PairingResponseSchema>;

export const AuthChallengeSchema = Type.Object(
  {
    nonce: Type.String(),
    hostId: Type.String(),
    timestamp: Type.Integer(),
  },
  { $id: "AuthChallenge" }
);
export type AuthChallenge = Static<typeof AuthChallengeSchema>;

export const AuthSolutionSchema = Type.Object(
  {
    deviceId: Type.String(),
    signature: Type.String(),
  },
  { $id: "AuthSolution" }
);
export type AuthSolution = Static<typeof AuthSolutionSchema>;

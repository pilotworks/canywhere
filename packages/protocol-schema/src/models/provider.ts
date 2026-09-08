import { Type, type Static } from "@sinclair/typebox";

export const AdapterCapabilitiesSchema = Type.Object(
  {
    workspace: Type.Boolean(),
    multiRoot: Type.Boolean(),
    approvals: Type.Boolean(),
    resumeThread: Type.Boolean(),
    standaloneChat: Type.Boolean(),
    steering: Type.Boolean(),
  },
  { $id: "AdapterCapabilities" }
);
export type AdapterCapabilities = Static<typeof AdapterCapabilitiesSchema>;

export const ProviderStatusSchema = Type.Union(
  [Type.Literal("ready"), Type.Literal("unavailable"), Type.Literal("error")],
  { $id: "ProviderStatus" }
);
export type ProviderStatus = Static<typeof ProviderStatusSchema>;

export const ProviderSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    version: Type.String(),
    capabilities: AdapterCapabilitiesSchema,
    status: ProviderStatusSchema,
    statusMessage: Type.Optional(Type.String()),
  },
  { $id: "Provider" }
);
export type Provider = Static<typeof ProviderSchema>;

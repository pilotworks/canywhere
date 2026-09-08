import { Type, type Static } from "@sinclair/typebox";

export const ApprovalKindSchema = Type.Union(
  [
    Type.Literal("command"),
    Type.Literal("file_change"),
    Type.Literal("user_input"),
  ],
  { $id: "ApprovalKind" }
);
export type ApprovalKind = Static<typeof ApprovalKindSchema>;

export const ApprovalStatusSchema = Type.Union(
  [
    Type.Literal("pending"),
    Type.Literal("approved"),
    Type.Literal("denied"),
    Type.Literal("canceled"),
  ],
  { $id: "ApprovalStatus" }
);
export type ApprovalStatus = Static<typeof ApprovalStatusSchema>;

export const ApprovalDecisionSchema = Type.Union(
  [
    Type.Literal("accept"),
    Type.Literal("accept_for_session"),
    Type.Literal("decline"),
    Type.Literal("cancel"),
  ],
  { $id: "ApprovalDecision" }
);
export type ApprovalDecision = Static<typeof ApprovalDecisionSchema>;

export const ApprovalPayloadSchema = Type.Object(
  {
    command: Type.Optional(Type.String()),
    cwd: Type.Optional(Type.String()),
    reason: Type.Optional(Type.String()),
    diff: Type.Optional(Type.String()),
    path: Type.Optional(Type.String()),
    prompt: Type.Optional(Type.String()),
    isHighRisk: Type.Optional(Type.Boolean()),
  },
  { $id: "ApprovalPayload" }
);
export type ApprovalPayload = Static<typeof ApprovalPayloadSchema>;

export const ApprovalRequestSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    chatId: Type.String(),
    turnId: Type.String(),
    externalRequestId: Type.String(),
    kind: ApprovalKindSchema,
    payload: ApprovalPayloadSchema,
    status: ApprovalStatusSchema,
    requestedAt: Type.Integer(),
    resolvedAt: Type.Optional(Type.Integer()),
    resolvedByDeviceId: Type.Optional(Type.String()),
    resolvedByDeviceName: Type.Optional(Type.String()),
  },
  { $id: "ApprovalRequest" }
);
export type ApprovalRequest = Static<typeof ApprovalRequestSchema>;

export const ApprovalResponseInputSchema = Type.Object(
  {
    approvalId: Type.String(),
    decision: ApprovalDecisionSchema,
  },
  { $id: "ApprovalResponseInput" }
);
export type ApprovalResponseInput = Static<typeof ApprovalResponseInputSchema>;

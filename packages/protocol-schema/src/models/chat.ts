import { Type, type Static } from "@sinclair/typebox";

export const ChatKindSchema = Type.Union(
  [Type.Literal("workspace"), Type.Literal("standalone")],
  { $id: "ChatKind" }
);
export type ChatKind = Static<typeof ChatKindSchema>;

export const ChatStatusSchema = Type.Union(
  [
    Type.Literal("idle"),
    Type.Literal("running"),
    Type.Literal("awaiting_approval"),
    Type.Literal("error"),
  ],
  { $id: "ChatStatus" }
);
export type ChatStatus = Static<typeof ChatStatusSchema>;

export const ChatSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    kind: ChatKindSchema,
    workspaceId: Type.Optional(Type.String()),
    providerId: Type.String(),
    title: Type.String(),
    externalThreadId: Type.Optional(Type.String()),
    status: ChatStatusSchema,
    createdAt: Type.Integer(),
    updatedAt: Type.Integer(),
  },
  { $id: "Chat" }
);
export type Chat = Static<typeof ChatSchema>;

export const ChatCreateInputSchema = Type.Object(
  {
    kind: ChatKindSchema,
    workspaceId: Type.Optional(Type.String()),
    providerId: Type.String(),
    title: Type.Optional(Type.String()),
    initialPrompt: Type.Optional(Type.String()),
  },
  { $id: "ChatCreateInput" }
);
export type ChatCreateInput = Static<typeof ChatCreateInputSchema>;

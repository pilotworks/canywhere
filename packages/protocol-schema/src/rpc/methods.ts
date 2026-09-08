import { Type, type Static } from "@sinclair/typebox";
import { ProviderSchema } from "../models/provider.js";
import {
  WorkspaceSchema,
  WorkspaceCreateInputSchema,
  FileTreeNodeSchema,
} from "../models/workspace.js";
import {
  ChatSchema,
  ChatCreateInputSchema,
  ChatStatusSchema,
} from "../models/chat.js";
import { MessageSchema, MessageBlockSchema } from "../models/message.js";
import {
  ApprovalRequestSchema,
  ApprovalDecisionSchema,
} from "../models/approval.js";
import { DeviceSchema } from "../models/device.js";

// ==========================================
// SYSTEM METHODS
// ==========================================

export const SystemInfoResultSchema = Type.Object(
  {
    version: Type.String(),
    platform: Type.String(),
    arch: Type.String(),
    hostname: Type.String(),
    activeProviders: Type.Array(Type.String()),
    pairedDeviceCount: Type.Integer(),
  },
  { $id: "SystemInfoResult" }
);
export type SystemInfoResult = Static<typeof SystemInfoResultSchema>;

// ==========================================
// PROVIDER METHODS
// ==========================================

export const ProviderListResultSchema = Type.Object(
  {
    providers: Type.Array(ProviderSchema),
  },
  { $id: "ProviderListResult" }
);
export type ProviderListResult = Static<typeof ProviderListResultSchema>;

// ==========================================
// WORKSPACE METHODS
// ==========================================

export const WorkspaceListResultSchema = Type.Object(
  {
    workspaces: Type.Array(WorkspaceSchema),
  },
  { $id: "WorkspaceListResult" }
);
export type WorkspaceListResult = Static<typeof WorkspaceListResultSchema>;

export const WorkspaceCreateParamsSchema = WorkspaceCreateInputSchema;
export type WorkspaceCreateParams = Static<typeof WorkspaceCreateParamsSchema>;

export const WorkspaceTreeParamsSchema = Type.Object(
  {
    workspaceId: Type.String(),
    subPath: Type.Optional(Type.String()),
    maxDepth: Type.Optional(Type.Integer({ minimum: 1, maximum: 10 })),
  },
  { $id: "WorkspaceTreeParams" }
);
export type WorkspaceTreeParams = Static<typeof WorkspaceTreeParamsSchema>;

export const WorkspaceTreeResultSchema = Type.Object(
  {
    root: FileTreeNodeSchema,
  },
  { $id: "WorkspaceTreeResult" }
);
export type WorkspaceTreeResult = Static<typeof WorkspaceTreeResultSchema>;

// ==========================================
// CHAT METHODS
// ==========================================

export const ChatListParamsSchema = Type.Object(
  {
    workspaceId: Type.Optional(Type.String()),
    kind: Type.Optional(
      Type.Union([Type.Literal("workspace"), Type.Literal("standalone")])
    ),
  },
  { $id: "ChatListParams" }
);
export type ChatListParams = Static<typeof ChatListParamsSchema>;

export const ChatListResultSchema = Type.Object(
  {
    chats: Type.Array(ChatSchema),
  },
  { $id: "ChatListResult" }
);
export type ChatListResult = Static<typeof ChatListResultSchema>;

export const ChatCreateParamsSchema = ChatCreateInputSchema;
export type ChatCreateParams = Static<typeof ChatCreateParamsSchema>;

export const ChatGetParamsSchema = Type.Object(
  {
    chatId: Type.String(),
  },
  { $id: "ChatGetParams" }
);
export type ChatGetParams = Static<typeof ChatGetParamsSchema>;

export const ChatGetResultSchema = Type.Object(
  {
    chat: ChatSchema,
    messages: Type.Array(MessageSchema),
    pendingApprovals: Type.Array(ApprovalRequestSchema),
  },
  { $id: "ChatGetResult" }
);
export type ChatGetResult = Static<typeof ChatGetResultSchema>;

export const ChatDeleteParamsSchema = Type.Object(
  {
    chatId: Type.String(),
  },
  { $id: "ChatDeleteParams" }
);
export type ChatDeleteParams = Static<typeof ChatDeleteParamsSchema>;

// ==========================================
// TURN & EXECUTION METHODS
// ==========================================

export const TurnSendParamsSchema = Type.Object(
  {
    chatId: Type.String(),
    content: Type.String(),
    clientMessageId: Type.Optional(Type.String()),
  },
  { $id: "TurnSendParams" }
);
export type TurnSendParams = Static<typeof TurnSendParamsSchema>;

export const TurnSendResultSchema = Type.Object(
  {
    turnId: Type.String(),
    status: ChatStatusSchema,
  },
  { $id: "TurnSendResult" }
);
export type TurnSendResult = Static<typeof TurnSendResultSchema>;

export const TurnSteerParamsSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
    content: Type.String(),
  },
  { $id: "TurnSteerParams" }
);
export type TurnSteerParams = Static<typeof TurnSteerParamsSchema>;

export const TurnInterruptParamsSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
  },
  { $id: "TurnInterruptParams" }
);
export type TurnInterruptParams = Static<typeof TurnInterruptParamsSchema>;

// ==========================================
// APPROVAL METHODS
// ==========================================

export const ApprovalRespondParamsSchema = Type.Object(
  {
    approvalId: Type.String(),
    decision: ApprovalDecisionSchema,
  },
  { $id: "ApprovalRespondParams" }
);
export type ApprovalRespondParams = Static<typeof ApprovalRespondParamsSchema>;

// ==========================================
// DEVICE METHODS
// ==========================================

export const DeviceListResultSchema = Type.Object(
  {
    devices: Type.Array(DeviceSchema),
  },
  { $id: "DeviceListResult" }
);
export type DeviceListResult = Static<typeof DeviceListResultSchema>;

export const DeviceRevokeParamsSchema = Type.Object(
  {
    deviceId: Type.String(),
  },
  { $id: "DeviceRevokeParams" }
);
export type DeviceRevokeParams = Static<typeof DeviceRevokeParamsSchema>;

// ==========================================
// REAL-TIME STREAMING NOTIFICATIONS
// ==========================================

export const TurnStartedNotificationSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
    userMessage: MessageSchema,
  },
  { $id: "TurnStartedNotification" }
);
export type TurnStartedNotification = Static<
  typeof TurnStartedNotificationSchema
>;

export const MessageDeltaPayloadSchema = Type.Union(
  [
    Type.Object({ type: Type.Literal("text"), text: Type.String() }),
    Type.Object({ type: Type.Literal("reasoning"), text: Type.String() }),
    Type.Object({ type: Type.Literal("plan"), text: Type.String() }),
  ],
  { $id: "MessageDeltaPayload" }
);
export type MessageDeltaPayload = Static<typeof MessageDeltaPayloadSchema>;

export const MessageDeltaNotificationSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
    messageId: Type.String(),
    delta: MessageDeltaPayloadSchema,
  },
  { $id: "MessageDeltaNotification" }
);
export type MessageDeltaNotification = Static<
  typeof MessageDeltaNotificationSchema
>;

export const ToolStartedNotificationSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
    block: MessageBlockSchema,
  },
  { $id: "ToolStartedNotification" }
);
export type ToolStartedNotification = Static<
  typeof ToolStartedNotificationSchema
>;

export const ToolCompletedNotificationSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
    block: MessageBlockSchema,
  },
  { $id: "ToolCompletedNotification" }
);
export type ToolCompletedNotification = Static<
  typeof ToolCompletedNotificationSchema
>;

export const ApprovalRequestedNotificationSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
    approval: ApprovalRequestSchema,
  },
  { $id: "ApprovalRequestedNotification" }
);
export type ApprovalRequestedNotification = Static<
  typeof ApprovalRequestedNotificationSchema
>;

export const ApprovalResolvedNotificationSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
    approvalId: Type.String(),
    decision: ApprovalDecisionSchema,
    resolvedByDeviceId: Type.String(),
    resolvedByDeviceName: Type.String(),
  },
  { $id: "ApprovalResolvedNotification" }
);
export type ApprovalResolvedNotification = Static<
  typeof ApprovalResolvedNotificationSchema
>;

export const TurnCompletedNotificationSchema = Type.Object(
  {
    chatId: Type.String(),
    turnId: Type.String(),
    status: ChatStatusSchema,
    agentMessage: Type.Optional(MessageSchema),
    tokensUsed: Type.Optional(
      Type.Object({
        input: Type.Integer(),
        output: Type.Integer(),
        total: Type.Integer(),
      })
    ),
  },
  { $id: "TurnCompletedNotification" }
);
export type TurnCompletedNotification = Static<
  typeof TurnCompletedNotificationSchema
>;

export const DevicePresenceNotificationSchema = Type.Object(
  {
    deviceId: Type.String(),
    online: Type.Boolean(),
    lastSeenAt: Type.Integer(),
  },
  { $id: "DevicePresenceNotification" }
);
export type DevicePresenceNotification = Static<
  typeof DevicePresenceNotificationSchema
>;

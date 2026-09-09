export * from "./generated/ApprovalKind.js";
export * from "./generated/ApprovalPayload.js";
export * from "./generated/ApprovalRequest.js";
export * from "./generated/ApprovalStatus.js";
export * from "./generated/Chat.js";
export * from "./generated/ChatKind.js";
export * from "./generated/ChatStatus.js";
export * from "./generated/CommandExecStatus.js";
export * from "./generated/Device.js";
export * from "./generated/DevicePlatform.js";
export * from "./generated/DeviceTransport.js";
export * from "./generated/FileDiffStatus.js";
export * from "./generated/FileTreeNode.js";
export * from "./generated/Message.js";
export * from "./generated/MessageBlock.js";
export * from "./generated/MessageRole.js";
export * from "./generated/RpcErrorData.js";
export * from "./generated/RpcId.js";
export * from "./generated/RpcNotificationEnvelope.js";
export * from "./generated/RpcRequestEnvelope.js";
export * from "./generated/RpcResponseEnvelope.js";
export * from "./generated/ModelInfo.js";
export * from "./generated/PermissionMode.js";
import { PermissionMode } from "./generated/PermissionMode.js";
export * from "./generated/Provider.js";
export * from "./generated/ToolCallStatus.js";
export * from "./generated/Workspace.js";
export * from "./generated/FuzzyFileMatchItem.js";
export * from "./generated/WorkspaceFileSearchResult.js";
export * from "./generated/GitFileChange.js";
export * from "./generated/GitStatusResult.js";
export * from "./generated/GitDiffResult.js";
export * from "./generated/GitBranchesResult.js";
export * from "./generated/GitCommitItem.js";
export * from "./generated/GitLogResult.js";

export type ApprovalDecision = "accept" | "accept_for_session" | "decline" | "cancel";

export interface PairingQrPayload {
  hostId: string;
  hostName: string;
  token: string;
  endpoints: string[];
  hostPublicKey: string;
  expiresAt: number;
}

export interface QueuedMessage {
  id: string;
  chatId: string;
  content: string;
  model?: string | null;
  effort?: string | null;
  permissionMode?: PermissionMode;
  createdAt: number;
}

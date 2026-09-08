import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  quicktype,
  InputData,
  JSONSchemaInput,
  FetchingJSONSchemaStore,
} from "quicktype-core";
import {
  ProviderSchema,
  AdapterCapabilitiesSchema,
  WorkspaceSchema,
  WorkspaceCreateInputSchema,
  FileTreeNodeSchema,
  ChatSchema,
  ChatCreateInputSchema,
  MessageSchema,
  MessageBlockSchema,
  ApprovalRequestSchema,
  ApprovalResponseInputSchema,
  ApprovalDecisionSchema,
  DeviceSchema,
  PairingQrPayloadSchema,
  PairingRequestSchema,
  PairingResponseSchema,
  AuthChallengeSchema,
  AuthSolutionSchema,
  RpcRequestEnvelopeSchema,
  RpcResponseEnvelopeSchema,
  RpcNotificationEnvelopeSchema,
  TurnStartedNotificationSchema,
  MessageDeltaNotificationSchema,
  ToolStartedNotificationSchema,
  ToolCompletedNotificationSchema,
  ApprovalRequestedNotificationSchema,
  ApprovalResolvedNotificationSchema,
  TurnCompletedNotificationSchema,
  DevicePresenceNotificationSchema,
  SystemInfoResultSchema,
  ProviderListResultSchema,
  WorkspaceListResultSchema,
  WorkspaceTreeParamsSchema,
  WorkspaceTreeResultSchema,
  ChatListParamsSchema,
  ChatListResultSchema,
  ChatGetParamsSchema,
  ChatGetResultSchema,
  TurnSendParamsSchema,
  TurnSendResultSchema,
  TurnSteerParamsSchema,
  TurnInterruptParamsSchema,
  DeviceListResultSchema,
} from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const targetSchemas = [
  { name: "Provider", schema: ProviderSchema },
  { name: "AdapterCapabilities", schema: AdapterCapabilitiesSchema },
  { name: "Workspace", schema: WorkspaceSchema },
  { name: "WorkspaceCreateInput", schema: WorkspaceCreateInputSchema },
  { name: "FileTreeNode", schema: FileTreeNodeSchema },
  { name: "Chat", schema: ChatSchema },
  { name: "ChatCreateInput", schema: ChatCreateInputSchema },
  { name: "Message", schema: MessageSchema },
  { name: "MessageBlock", schema: MessageBlockSchema },
  { name: "ApprovalRequest", schema: ApprovalRequestSchema },
  { name: "ApprovalResponseInput", schema: ApprovalResponseInputSchema },
  { name: "ApprovalDecision", schema: ApprovalDecisionSchema },
  { name: "Device", schema: DeviceSchema },
  { name: "PairingQrPayload", schema: PairingQrPayloadSchema },
  { name: "PairingRequest", schema: PairingRequestSchema },
  { name: "PairingResponse", schema: PairingResponseSchema },
  { name: "AuthChallenge", schema: AuthChallengeSchema },
  { name: "AuthSolution", schema: AuthSolutionSchema },
  { name: "RpcRequestEnvelope", schema: RpcRequestEnvelopeSchema },
  { name: "RpcResponseEnvelope", schema: RpcResponseEnvelopeSchema },
  { name: "RpcNotificationEnvelope", schema: RpcNotificationEnvelopeSchema },
  { name: "TurnStartedNotification", schema: TurnStartedNotificationSchema },
  { name: "MessageDeltaNotification", schema: MessageDeltaNotificationSchema },
  { name: "ToolStartedNotification", schema: ToolStartedNotificationSchema },
  { name: "ToolCompletedNotification", schema: ToolCompletedNotificationSchema },
  {
    name: "ApprovalRequestedNotification",
    schema: ApprovalRequestedNotificationSchema,
  },
  {
    name: "ApprovalResolvedNotification",
    schema: ApprovalResolvedNotificationSchema,
  },
  { name: "TurnCompletedNotification", schema: TurnCompletedNotificationSchema },
  {
    name: "DevicePresenceNotification",
    schema: DevicePresenceNotificationSchema,
  },
  { name: "SystemInfoResult", schema: SystemInfoResultSchema },
  { name: "ProviderListResult", schema: ProviderListResultSchema },
  { name: "WorkspaceListResult", schema: WorkspaceListResultSchema },
  { name: "WorkspaceTreeParams", schema: WorkspaceTreeParamsSchema },
  { name: "WorkspaceTreeResult", schema: WorkspaceTreeResultSchema },
  { name: "ChatListParams", schema: ChatListParamsSchema },
  { name: "ChatListResult", schema: ChatListResultSchema },
  { name: "ChatGetParams", schema: ChatGetParamsSchema },
  { name: "ChatGetResult", schema: ChatGetResultSchema },
  { name: "TurnSendParams", schema: TurnSendParamsSchema },
  { name: "TurnSendResult", schema: TurnSendResultSchema },
  { name: "TurnSteerParams", schema: TurnSteerParamsSchema },
  { name: "TurnInterruptParams", schema: TurnInterruptParamsSchema },
  { name: "DeviceListResult", schema: DeviceListResultSchema },
];

async function generateSwiftModels(): Promise<void> {
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());

  for (const item of targetSchemas) {
    await schemaInput.addSource({
      name: item.name,
      schema: JSON.stringify(item.schema),
    });
  }

  const inputData = new InputData();
  inputData.addInput(schemaInput);

  console.log(`Generating Swift models for ${targetSchemas.length} schemas...`);

  const result = await quicktype({
    inputData,
    lang: "swift",
    rendererOptions: {
      structOrClass: "struct",
      density: "normal",
      mutableProperties: "false",
      swift5Support: "true",
      sendable: "true",
    },
  });

  const outputDir = resolve(__dirname, "../../../mobile/ios/Models/Generated");
  mkdirSync(outputDir, { recursive: true });

  const outputFile = resolve(outputDir, "ProtocolModels.swift");
  const header = `//
// ProtocolModels.swift
// Generated automatically from @canywhere/protocol-schema via quicktype.
// DO NOT EDIT MANUALLY. Run 'pnpm run codegen' to regenerate.
//

import Foundation

`;

  writeFileSync(outputFile, header + result.lines.join("\n"), "utf8");
  console.log(`✓ Successfully generated Swift models: ${outputFile} (${result.lines.length} lines)`);
}

generateSwiftModels().catch((err) => {
  console.error("Codegen failed:", err);
  process.exit(1);
});

import { Type, type Static } from "@sinclair/typebox";

export const MessageRoleSchema = Type.Union(
  [Type.Literal("user"), Type.Literal("agent"), Type.Literal("system")],
  { $id: "MessageRole" }
);
export type MessageRole = Static<typeof MessageRoleSchema>;

export const TextBlockSchema = Type.Object(
  {
    type: Type.Literal("text"),
    content: Type.String(),
  },
  { $id: "TextBlock" }
);
export type TextBlock = Static<typeof TextBlockSchema>;

export const ReasoningBlockSchema = Type.Object(
  {
    type: Type.Literal("reasoning"),
    content: Type.String(),
    completed: Type.Boolean(),
  },
  { $id: "ReasoningBlock" }
);
export type ReasoningBlock = Static<typeof ReasoningBlockSchema>;

export const PlanBlockSchema = Type.Object(
  {
    type: Type.Literal("plan"),
    content: Type.String(),
  },
  { $id: "PlanBlock" }
);
export type PlanBlock = Static<typeof PlanBlockSchema>;

export const ToolCallStatusSchema = Type.Union(
  [Type.Literal("running"), Type.Literal("completed"), Type.Literal("failed")],
  { $id: "ToolCallStatus" }
);
export type ToolCallStatus = Static<typeof ToolCallStatusSchema>;

export const ToolCallBlockSchema = Type.Object(
  {
    type: Type.Literal("tool_call"),
    callId: Type.String(),
    name: Type.String(),
    args: Type.Record(Type.String(), Type.Unknown()),
    output: Type.Optional(Type.String()),
    status: ToolCallStatusSchema,
  },
  { $id: "ToolCallBlock" }
);
export type ToolCallBlock = Static<typeof ToolCallBlockSchema>;

export const FileDiffStatusSchema = Type.Union(
  [Type.Literal("proposed"), Type.Literal("applied"), Type.Literal("rejected")],
  { $id: "FileDiffStatus" }
);
export type FileDiffStatus = Static<typeof FileDiffStatusSchema>;

export const FileDiffBlockSchema = Type.Object(
  {
    type: Type.Literal("file_diff"),
    path: Type.String(),
    patch: Type.String(),
    status: FileDiffStatusSchema,
  },
  { $id: "FileDiffBlock" }
);
export type FileDiffBlock = Static<typeof FileDiffBlockSchema>;

export const CommandExecStatusSchema = Type.Union(
  [
    Type.Literal("pending_approval"),
    Type.Literal("running"),
    Type.Literal("completed"),
    Type.Literal("failed"),
  ],
  { $id: "CommandExecStatus" }
);
export type CommandExecStatus = Static<typeof CommandExecStatusSchema>;

export const CommandExecBlockSchema = Type.Object(
  {
    type: Type.Literal("command_exec"),
    command: Type.String(),
    cwd: Type.String(),
    output: Type.Optional(Type.String()),
    exitCode: Type.Optional(Type.Integer()),
    status: CommandExecStatusSchema,
  },
  { $id: "CommandExecBlock" }
);
export type CommandExecBlock = Static<typeof CommandExecBlockSchema>;

export const MessageBlockSchema = Type.Union(
  [
    TextBlockSchema,
    ReasoningBlockSchema,
    PlanBlockSchema,
    ToolCallBlockSchema,
    FileDiffBlockSchema,
    CommandExecBlockSchema,
  ],
  { $id: "MessageBlock" }
);
export type MessageBlock = Static<typeof MessageBlockSchema>;

export const MessageSchema = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    chatId: Type.String(),
    turnId: Type.Optional(Type.String()),
    role: MessageRoleSchema,
    blocks: Type.Array(MessageBlockSchema),
    createdAt: Type.Integer(),
    streaming: Type.Boolean(),
  },
  { $id: "Message" }
);
export type Message = Static<typeof MessageSchema>;

import { EventEmitter } from "node:events";
import { ApprovalRequest, ApprovalDecision, MessageBlock } from "@canywhere/protocol-schema";

export type AgentEvent =
  | { type: "tokenDelta"; chatId: string; messageId: string; blockId: string; delta: string }
  | { type: "blockStarted"; chatId: string; messageId: string; block: MessageBlock }
  | { type: "blockUpdated"; chatId: string; messageId: string; blockId: string; update: Partial<MessageBlock> }
  | { type: "blockCompleted"; chatId: string; messageId: string; blockId: string; finalBlock?: MessageBlock }
  | { type: "approvalRequested"; chatId: string; request: ApprovalRequest }
  | { type: "turnCompleted"; chatId: string; turnId: string; status: "completed" | "interrupted" | "failed"; error?: string }
  | { type: "threadStarted"; chatId: string; threadId: string };

export interface StartThreadOptions {
  chatId: string;
  cwd: string;
  model?: string;
  subPaths?: string[];
  existingThreadId?: string;
}

export interface SubmitTurnOptions {
  chatId: string;
  threadId: string;
  messageId: string;
  prompt: string;
}

export interface SteerTurnOptions {
  chatId: string;
  threadId: string;
  expectedTurnId: string;
  feedback: string;
}

export interface InterruptTurnOptions {
  chatId: string;
  threadId: string;
  expectedTurnId: string;
}

export interface RespondApprovalOptions {
  chatId: string;
  approvalId: string;
  callId: string;
  decision: ApprovalDecision;
}

export interface CliAdapter extends EventEmitter {
  initialize(): Promise<void>;
  startThread(options: StartThreadOptions): Promise<{ threadId: string }>;
  submitTurn(options: SubmitTurnOptions): Promise<{ turnId: string }>;
  steerTurn(options: SteerTurnOptions): Promise<void>;
  interruptTurn(options: InterruptTurnOptions): Promise<void>;
  respondApproval(options: RespondApprovalOptions): Promise<void>;
  dispose(): Promise<void>;
}

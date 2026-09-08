export interface TokenDelta {
  chatId: string;
  messageId: string;
  blockId: string;
  delta: string;
}

export class TokenStreamBuffer {
  private buffer: Map<string, { chatId: string; messageId: string; text: string }> = new Map();
  private timer: any = null;
  private flushCallback: (flushed: Array<{ chatId: string; messageId: string; blockId: string; text: string }>) => void;
  private intervalMs: number;

  constructor(
    flushCallback: (flushed: Array<{ chatId: string; messageId: string; blockId: string; text: string }>) => void,
    intervalMs: number = 24
  ) {
    this.flushCallback = flushCallback;
    this.intervalMs = intervalMs;
  }

  append(delta: TokenDelta): void {
    const key = `${delta.chatId}:${delta.messageId}:${delta.blockId}`;
    const existing = this.buffer.get(key);
    if (existing) {
      existing.text += delta.delta;
    } else {
      this.buffer.set(key, {
        chatId: delta.chatId,
        messageId: delta.messageId,
        text: delta.delta
      });
    }

    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.intervalMs);
    }
  }

  flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.buffer.size === 0) return;

    const flushed: Array<{ chatId: string; messageId: string; blockId: string; text: string }> = [];
    for (const [key, val] of this.buffer.entries()) {
      const parts = key.split(":");
      const blockId = parts.slice(2).join(":");
      flushed.push({
        chatId: val.chatId,
        messageId: val.messageId,
        blockId,
        text: val.text
      });
    }

    this.buffer.clear();
    this.flushCallback(flushed);
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.buffer.clear();
  }
}

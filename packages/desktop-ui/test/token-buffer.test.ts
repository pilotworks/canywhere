import { describe, it, expect } from "vitest";
import { TokenStreamBuffer } from "../src/network/buffer.js";

describe("TokenStreamBuffer", () => {
  it("should aggregate rapid fire token deltas into batched updates", async () => {
    const batches: any[] = [];
    const buffer = new TokenStreamBuffer((flushed) => {
      batches.push(flushed);
    }, 20);

    // Simulate 50 incoming token deltas for same block
    for (let i = 0; i < 50; i++) {
      buffer.append({
        chatId: "chat-1",
        messageId: "msg-1",
        blockId: "blk-1",
        delta: "token_" + i + " "
      });
    }

    // Nothing flushed synchronously
    expect(batches).toHaveLength(0);

    // Wait for timer flush
    await new Promise((res) => setTimeout(res, 40));

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
    expect(batches[0][0].blockId).toBe("blk-1");
    expect(batches[0][0].text).toContain("token_0 ");
    expect(batches[0][0].text).toContain("token_49 ");

    buffer.destroy();
  });
});

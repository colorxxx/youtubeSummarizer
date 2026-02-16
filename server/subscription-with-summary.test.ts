import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 111): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Subscription with Auto-Summary", () => {
  it("should add subscription and generate summaries for recent videos", async () => {
    const ctx = createTestContext(100);
    const caller = appRouter.createCaller(ctx);

    // Use a real YouTube channel for testing
    const testChannel = {
      channelId: "UCsXVk37bltHxD1rDPwtNM8Q", // Kurzgesagt channel
      channelName: "Kurzgesagt – In a Nutshell",
      channelThumbnail: "https://yt3.googleusercontent.com/ytc/test",
    };

    const result = await caller.subscriptions.add(testChannel);
    
    expect(result.success).toBe(true);
    expect(result.summaries).toBeDefined();
    expect(Array.isArray(result.summaries)).toBe(true);
    
    // Should have fetched and summarized videos
    if (result.summaries && result.summaries.length > 0) {
      const firstSummary = result.summaries[0];
      expect(firstSummary).toHaveProperty("videoId");
      expect(firstSummary).toHaveProperty("title");
      expect(firstSummary).toHaveProperty("summary");
      expect(typeof firstSummary.summary).toBe("string");
      expect(firstSummary.summary.length).toBeGreaterThan(0);
    }

    // Verify subscription was added
    const subscriptions = await caller.subscriptions.list();
    const found = subscriptions.find((s) => s.channelId === testChannel.channelId);
    expect(found).toBeDefined();
    
    // Verify summaries were saved to database
    const summaries = await caller.summaries.list();
    expect(summaries.length).toBeGreaterThan(0);
  }, 60000); // 60 second timeout for API calls and AI generation
});

import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 999): TrpcContext {
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

describe("Subscription Management", () => {
  it("should list user subscriptions", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const subscriptions = await caller.subscriptions.list();
    
    expect(Array.isArray(subscriptions)).toBe(true);
  });

  it("should add a new subscription", async () => {
    const ctx = createTestContext(888);
    const caller = appRouter.createCaller(ctx);

    const testChannel = {
      channelId: `test-channel-${Date.now()}`,
      channelName: "Test Channel",
      channelThumbnail: "https://example.com/thumb.jpg",
    };

    const result = await caller.subscriptions.add(testChannel);
    
    expect(result).toEqual({ success: true });

    // Verify it was added
    const subscriptions = await caller.subscriptions.list();
    const found = subscriptions.find((s) => s.channelId === testChannel.channelId);
    expect(found).toBeDefined();
    expect(found?.channelName).toBe(testChannel.channelName);
  });

  it("should remove a subscription", async () => {
    const ctx = createTestContext(777);
    const caller = appRouter.createCaller(ctx);

    // First add a subscription
    const testChannel = {
      channelId: `test-channel-remove-${Date.now()}`,
      channelName: "Test Channel to Remove",
    };

    await caller.subscriptions.add(testChannel);

    // Then remove it
    const result = await caller.subscriptions.remove({ channelId: testChannel.channelId });
    expect(result).toEqual({ success: true });

    // Verify it was removed
    const subscriptions = await caller.subscriptions.list();
    const found = subscriptions.find((s) => s.channelId === testChannel.channelId);
    expect(found).toBeUndefined();
  });

  it("should not allow duplicate subscriptions", async () => {
    const ctx = createTestContext(666);
    const caller = appRouter.createCaller(ctx);

    const testChannel = {
      channelId: `test-channel-dup-${Date.now()}`,
      channelName: "Duplicate Test Channel",
    };

    // Add first time
    await caller.subscriptions.add(testChannel);

    // Try to add again
    await expect(caller.subscriptions.add(testChannel)).rejects.toThrow("Already subscribed");
  });
});

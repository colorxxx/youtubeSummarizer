import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 555): TrpcContext {
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

describe("User Settings", () => {
  it("should update user settings", async () => {
    const ctx = createTestContext(444);
    const caller = appRouter.createCaller(ctx);

    const settingsData = {
      email: "newemail@example.com",
      emailEnabled: true,
      summaryFrequency: "weekly" as const,
    };

    const result = await caller.settings.update(settingsData);
    expect(result).toEqual({ success: true });

    // Verify settings were saved
    const settings = await caller.settings.get();
    expect(settings).toBeDefined();
    expect(settings?.email).toBe(settingsData.email);
    expect(settings?.emailEnabled).toBe(1);
    expect(settings?.summaryFrequency).toBe("weekly");
  });

  it("should get user settings", async () => {
    const ctx = createTestContext(333);
    const caller = appRouter.createCaller(ctx);

    // First create settings
    await caller.settings.update({
      email: "test333@example.com",
      emailEnabled: true,
      summaryFrequency: "daily",
    });

    // Then retrieve them
    const settings = await caller.settings.get();
    expect(settings).toBeDefined();
    expect(settings?.userId).toBe(333);
    expect(settings?.email).toBe("test333@example.com");
  });

  it("should toggle email enabled status", async () => {
    const ctx = createTestContext(222);
    const caller = appRouter.createCaller(ctx);

    // Enable email
    await caller.settings.update({
      email: "test222@example.com",
      emailEnabled: true,
      summaryFrequency: "daily",
    });

    let settings = await caller.settings.get();
    expect(settings?.emailEnabled).toBe(1);

    // Disable email
    await caller.settings.update({
      email: "test222@example.com",
      emailEnabled: false,
      summaryFrequency: "daily",
    });

    settings = await caller.settings.get();
    expect(settings?.emailEnabled).toBe(0);
  });
});

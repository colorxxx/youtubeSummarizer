import "dotenv/config";
import { describe, expect, it, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

// 고정 테스트 유저 ID (다른 테스트와 충돌 방지)
const TEST_USER_ID = 9999;

function createTestContext(userId: number = TEST_USER_ID): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `e2e-test-user-${userId}`,
    email: `e2e-test${userId}@example.com`,
    name: `E2E Test User ${userId}`,
    loginMethod: "google",
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("E2E Integration Test — Full Pipeline", () => {
  const ctx = createTestContext();
  const caller = appRouter.createCaller(ctx);

  let subscribedChannelId: string;
  let subscribedChannelName: string;
  let subscribedChannelThumbnail: string | undefined;

  // 정리: 테스트 종료 후 구독 해제 (실패해도 무시)
  afterAll(async () => {
    if (subscribedChannelId) {
      try {
        await caller.subscriptions.remove({ channelId: subscribedChannelId });
      } catch {
        // 이미 삭제됐거나 존재하지 않으면 무시
      }
    }
  });

  it("1. YouTube 채널 검색", async () => {
    const results = await caller.youtube.searchChannels({ query: "TED", maxResults: 5 });

    expect(results.length).toBeGreaterThanOrEqual(1);
    // searchChannels returns { id, title, description, thumbnail }
    expect(results[0]).toHaveProperty("id");
    expect(results[0]).toHaveProperty("title");
    expect(results[0].id).toBeTruthy();
    expect(results[0].title).toBeTruthy();

    // 첫 번째 결과를 이후 테스트에서 사용
    subscribedChannelId = results[0].id;
    subscribedChannelName = results[0].title;
    subscribedChannelThumbnail = results[0].thumbnail;
  }, 30_000);

  it("2. 채널 구독", async () => {
    const result = await caller.subscriptions.add({
      channelId: subscribedChannelId,
      channelName: subscribedChannelName,
      channelThumbnail: subscribedChannelThumbnail,
    });

    expect(result.success).toBe(true);
  }, 30_000);

  it("3. 구독 목록에 추가된 채널 확인", async () => {
    const subs = await caller.subscriptions.list();
    const found = subs.find((s) => s.channelId === subscribedChannelId);

    expect(found).toBeDefined();
    expect(found!.channelName).toBe(subscribedChannelName);
  }, 10_000);

  it("4. 백그라운드 요약 생성 대기 + 요약 확인", async () => {
    // subscriptions.add 의 fire-and-forget 백그라운드 처리 대기
    // 최대 90초, 5초 간격 폴링
    const maxWait = 90_000;
    const pollInterval = 5_000;
    let elapsed = 0;
    let summaryList: Awaited<ReturnType<typeof caller.summaries.list>> = [];

    while (elapsed < maxWait) {
      await sleep(pollInterval);
      elapsed += pollInterval;

      summaryList = await caller.summaries.list();
      if (summaryList.length > 0) break;
    }

    expect(summaryList.length).toBeGreaterThanOrEqual(1);

    const first = summaryList[0];
    expect(first.summary).toBeTruthy();
    expect(first.summary.length).toBeGreaterThan(10);
    // detailedSummary 는 nullable 이지만, 있다면 비어있지 않아야 함
    if (first.detailedSummary) {
      expect(first.detailedSummary.length).toBeGreaterThan(10);
    }
  }, 120_000);

  it("5. 대시보드 — 채널별 요약 그룹 확인", async () => {
    const dashboard = await caller.dashboard.channelSummaries();

    expect(dashboard.length).toBeGreaterThanOrEqual(1);

    const channelGroup = dashboard.find((d) => d.channel.channelId === subscribedChannelId);
    expect(channelGroup).toBeDefined();
    expect(channelGroup!.summaries.length).toBeGreaterThanOrEqual(1);
  }, 15_000);

  it("6. 설정 변경 및 확인", async () => {
    await caller.settings.update({
      email: "e2e-test@example.com",
      emailEnabled: false,
      summaryFrequency: "weekly",
      videoCount: 5,
    });

    const settings = await caller.settings.get();
    expect(settings).toBeDefined();
    expect(settings!.email).toBe("e2e-test@example.com");
    expect(settings!.emailEnabled).toBe(0); // DB에서는 int
    expect(settings!.summaryFrequency).toBe("weekly");
    expect(settings!.videoCount).toBe(5);
  }, 10_000);

  it("7. 구독 해제 및 목록에서 제거 확인", async () => {
    const result = await caller.subscriptions.remove({ channelId: subscribedChannelId });
    expect(result.success).toBe(true);

    const subs = await caller.subscriptions.list();
    const found = subs.find((s) => s.channelId === subscribedChannelId);
    expect(found).toBeUndefined();

    // afterAll 에서 중복 삭제 방지
    subscribedChannelId = "";
  }, 10_000);
});

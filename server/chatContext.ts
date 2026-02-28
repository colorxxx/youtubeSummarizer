import type { LLMProvider } from "./_core/llm";
import { getContextLimits } from "./_core/llm";

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function buildSystemPrompt(
  video: { title: string; description: string | null },
  summary: { summary: string; detailedSummary?: string | null } | null,
  videoId: string,
  provider: LLMProvider = "qwen",
): Promise<string> {
  const { getOrFetchTranscript } = await import("./db");
  const transcriptResult = await getOrFetchTranscript(videoId);
  const transcript = transcriptResult.available ? transcriptResult.text : "";
  const limits = getContextLimits(provider);

  return [
    "당신은 유튜브 영상에 대해 질문에 답변하는 AI 어시스턴트입니다.",
    "항상 한국어로 답변하세요.",
    "자막 원본이 제공된 경우, 영상의 구체적인 내용을 바탕으로 정확하게 답변하세요.",
    "",
    "[도구 사용 안내]",
    "web_search 도구를 사용할 수 있습니다.",
    "- 영상 자막/요약으로 충분히 답변할 수 있는 질문에는 검색하지 마세요.",
    "- 최신 뉴스, 사실 확인, 영상에 없는 외부 정보가 필요할 때만 검색하세요.",
    "- 검색 결과를 인용할 때는 출처를 간략히 언급하세요.",
    "",
    "[영상 정보]",
    `제목: ${video.title}`,
    video.description ? `설명: ${video.description.slice(0, limits.description)}` : "",
    summary ? `요약: ${summary.summary}` : "",
    summary?.detailedSummary ? `상세 요약: ${summary.detailedSummary}` : "",
    transcript ? `\n[자막 원본]\n${transcript.slice(0, limits.chatTranscript)}` : "",
  ].filter(Boolean).join("\n");
}

function estimateTokens(text: string): number {
  // 한국어/영어 혼합 사용 기준 보수적 추정: ~1 토큰 / 2 chars
  return Math.ceil(text.length / 2);
}

export async function buildChatMessages(
  systemContent: string,
  history: { role: string; content: string }[],
  userMessage: string,
  provider: LLMProvider = "qwen",
): Promise<ChatMsg[]> {
  const limits = getContextLimits(provider);
  const INPUT_TOKEN_BUDGET = limits.chatTokenBudget;

  const systemTokens = estimateTokens(systemContent);
  const userTokens = estimateTokens(userMessage);
  const budgetForHistory = INPUT_TOKEN_BUDGET - systemTokens - userTokens;

  const historyMsgs = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
    tokens: estimateTokens(m.content),
  }));

  const totalHistoryTokens = historyMsgs.reduce((sum, m) => sum + m.tokens, 0);

  // 예산 내이면 전체 히스토리 사용
  if (totalHistoryTokens <= budgetForHistory) {
    return [
      { role: "system", content: systemContent },
      ...historyMsgs.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ];
  }

  // 예산 초과: 최신 메시지부터 역순으로 예산의 80% 내에서 확보
  let recentTokens = 0;
  let splitIndex = historyMsgs.length;
  for (let i = historyMsgs.length - 1; i >= 0; i--) {
    if (recentTokens + historyMsgs[i].tokens > budgetForHistory * 0.8) break;
    recentTokens += historyMsgs[i].tokens;
    splitIndex = i;
  }

  const oldMessages = historyMsgs.slice(0, splitIndex);
  const recentMessages = historyMsgs.slice(splitIndex);

  // 오래된 메시지를 LLM으로 요약
  let compactSummary = "";
  if (oldMessages.length > 0) {
    const { invokeLLM } = await import("./_core/llm");
    const compactPrompt = oldMessages
      .map((m) => `${m.role === "user" ? "사용자" : "AI"}: ${m.content}`)
      .join("\n");

    try {
      const compactResult = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "아래 대화 내용을 핵심만 간결하게 요약하세요. 중요한 질문, 답변, 결론만 포함합니다. 3~5문장으로.",
          },
          { role: "user", content: compactPrompt },
        ],
        maxTokens: 500,
      }, provider);

      compactSummary =
        typeof compactResult.choices[0]?.message?.content === "string"
          ? compactResult.choices[0].message.content
          : "";
    } catch (error) {
      console.error("[ChatContext] Compaction failed, using recent history only:", error);
    }
  }

  const enhancedSystem = compactSummary
    ? `${systemContent}\n\n[이전 대화 요약]\n${compactSummary}`
    : systemContent;

  return [
    { role: "system", content: enhancedSystem },
    ...recentMessages.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];
}

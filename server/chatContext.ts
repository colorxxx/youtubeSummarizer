const INPUT_TOKEN_BUDGET = 50000; // 64K context - 8K output - 6K safety margin

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

function estimateTokens(text: string): number {
  // 한국어/영어 혼합 사용 기준 보수적 추정: ~1 토큰 / 2 chars
  return Math.ceil(text.length / 2);
}

export async function buildChatMessages(
  systemContent: string,
  history: { role: string; content: string }[],
  userMessage: string,
): Promise<ChatMsg[]> {
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
      });

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

import { ENV } from "./_core/env";
import type { Tool, ToolCall } from "./_core/llm";

export const WEB_SEARCH_TOOL: Tool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for up-to-date information. Use this when the user asks about recent news, facts you're unsure about, or topics not covered in the video transcript.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query to look up on the web",
        },
      },
      required: ["query"],
    },
  },
};

export const CHAT_TOOLS: Tool[] = [WEB_SEARCH_TOOL];

type TavilyResult = {
  title: string;
  url: string;
  content: string;
};

type TavilyResponse = {
  results: TavilyResult[];
};

export async function executeWebSearch(query: string): Promise<string> {
  if (!ENV.tavilyApiKey) {
    return "웹 검색 API 키가 설정되지 않았습니다.";
  }

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: ENV.tavilyApiKey,
        query,
        max_results: 5,
        include_answer: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[WebSearch] Tavily API error:", response.status, errorText);
      return `웹 검색 실패: ${response.status}`;
    }

    const data = (await response.json()) as TavilyResponse;

    if (!data.results || data.results.length === 0) {
      return "검색 결과가 없습니다.";
    }

    return data.results
      .map((r, i) => {
        const content = r.content.length > 500 ? r.content.slice(0, 500) + "…" : r.content;
        return `[${i + 1}] ${r.title}\n${r.url}\n${content}`;
      })
      .join("\n\n");
  } catch (error) {
    console.error("[WebSearch] Error:", error);
    return "웹 검색 중 오류가 발생했습니다.";
  }
}

export async function executeToolCall(toolCall: ToolCall): Promise<string> {
  const { name, arguments: argsJson } = toolCall.function;

  if (name === "web_search") {
    const args = JSON.parse(argsJson) as { query: string };
    return executeWebSearch(args.query);
  }

  return `알 수 없는 도구: ${name}`;
}

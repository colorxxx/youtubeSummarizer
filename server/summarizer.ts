import { invokeLLM, getContextLimits } from "./_core/llm";
import type { LLMProvider } from "./_core/llm";
import { createLogger } from "./_core/logger";
import { getOrFetchTranscript } from "./db";


const log = createLogger("Summarizer");

/**
 * Generate AI summary for a YouTube video
 * Returns both brief and detailed summaries
 */
export async function generateVideoSummary(
  videoId: string,
  title: string,
  description: string,
  duration?: string,
  provider: LLMProvider = "qwen",
): Promise<{ brief: string; detailed: string }> {
  try {
    // Try to get transcript (from DB cache or YouTube)
    const transcript = await getOrFetchTranscript(videoId);

    // Prepare content for summarization
    // Use transcript if available, otherwise fall back to description
    const videoContent = transcript.available && transcript.text ? transcript.text : (description || title);

    if (!videoContent || videoContent.trim().length === 0) {
      return {
        brief: "No content available to summarize.",
        detailed: "No content available to summarize.",
      };
    }

    const limits = getContextLimits(provider);

    log.info(`Using provider: ${provider} (briefTranscript: ${limits.briefTranscript}, detailedTranscript: ${limits.detailedTranscript})`);

    // Generate brief summary
    const briefResponse = await invokeLLM({
      messages: [
        {
          role: "user",
          content: `아래 영상 자막의 핵심을 한국어로 요약하세요.\n"영상에서는" 같은 메타 표현 없이 정보를 직접 서술합니다.\n\n## 한줄 요약\n(핵심 메시지 1문장)\n\n## 핵심 포인트\n(5~7개 불릿포인트, 각각 구체적 사실 포함)\n\n---\n자막:\n${videoContent.substring(0, limits.briefTranscript)}`,
        },
      ],
    }, provider);

    // Generate detailed summary
    const detailedResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "당신은 전문 콘텐츠 분석가입니다.\n아래 영상 자막을 분석하여 한국어로 구조화된 요약을 작성하세요.\n\n[원칙]\n- 정보를 직접 서술. \"영상에서는\", \"화자는\" 같은 메타 표현 금지.\n- 자동 생성 자막의 오류, 반복, 필러는 무시하고 실질적 내용에 집중.\n- 간결하고 명확한 문체, 핵심 정보 누락 없이.\n\n[출력 형식]\n\n## 한줄 요약\n핵심 메시지 1문장.\n\n## 핵심 포인트\n- 가장 중요한 내용 5~8개 불릿포인트.\n- 각 포인트는 구체적 사실·수치·주장 포함한 완결된 문장.\n\n## 상세 내용\n주제별 소제목(###)으로 나누고, 각 주제 핵심을 2~4문장으로 설명. 중요한 예시·근거·인용 포함.\n\n## 키워드\n핵심 용어를 선별, 각각 한 문장으로 설명.",
        },
        {
          role: "user",
          content: `자막:\n${videoContent.substring(0, limits.detailedTranscript)}`,
        },
      ],
    }, provider);

    const briefContent = briefResponse.choices[0]?.message?.content;
    const detailedContent = detailedResponse.choices[0]?.message?.content;

    const brief = typeof briefContent === "string" ? briefContent.trim() : "Unable to generate brief summary.";
    const detailed = typeof detailedContent === "string" ? detailedContent.trim() : "Unable to generate detailed summary.";

    return { brief, detailed };
  } catch (error) {
    log.error("Error generating video summary:", error);
    return {
      brief: "Failed to generate summary due to an error.",
      detailed: "Failed to generate summary due to an error.",
    };
  }
}


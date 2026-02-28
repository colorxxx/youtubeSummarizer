import { invokeLLM, getContextLimits } from "./_core/llm";
import type { LLMProvider } from "./_core/llm";
import { createLogger } from "./_core/logger";
import { getOrFetchTranscript } from "./db";
import { parseDuration, getTargetSummaryLength } from "./videoUtils";

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

    // Determine summary length based on video duration
    const durationSeconds = duration ? parseDuration(duration) : 600; // Default to 10 min
    const targetLength = getTargetSummaryLength(durationSeconds);
    const limits = getContextLimits(provider);

    log.info(`Using provider: ${provider} (briefTranscript: ${limits.briefTranscript}, detailedTranscript: ${limits.detailedTranscript})`);

    // Generate brief summary
    const briefResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates concise summaries of YouTube video content in Korean. Focus on key points and main topics. Always respond in Korean language.",
        },
        {
          role: "user",
          content: `다음 유튜브 영상을 한국어로 간단히 요약해주세요:\n\n제목: ${title}\n\n${transcript.available ? '자막 내용' : '설명'}: ${videoContent.substring(0, limits.briefTranscript)}\n\n주요 내용과 핵심 포인트를 중심으로 ${targetLength.brief}으로 간결하게 요약해주세요.`,
        },
      ],
    }, provider);

    // Generate detailed summary
    const detailedResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates detailed, informative summaries of YouTube video content in Korean. Include key points, examples, insights, and actionable takeaways. Always respond in Korean language.",
        },
        {
          role: "user",
          content: `다음 유튜브 영상을 한국어로 상세히 요약해주세요:\n\n제목: ${title}\n\n${transcript.available ? '자막 내용' : '설명'}: ${videoContent.substring(0, limits.detailedTranscript)}\n\n${targetLength.detailed}하여 상세하게 요약해주세요. 주요 논점, 예시, 인사이트를 모두 포함해주세요.`,
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


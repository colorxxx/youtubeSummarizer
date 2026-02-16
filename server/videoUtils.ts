/**
 * Parse ISO 8601 duration format (PT1H2M10S) to seconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Categorize video length
 * - short: < 5 minutes
 * - medium: 5-20 minutes
 * - long: > 20 minutes
 */
export function categorizeVideoLength(durationSeconds: number): "short" | "medium" | "long" {
  if (durationSeconds < 300) return "short"; // < 5 min
  if (durationSeconds < 1200) return "medium"; // 5-20 min
  return "long"; // > 20 min
}

/**
 * Get target summary length based on video duration
 */
export function getTargetSummaryLength(durationSeconds: number): { brief: string; detailed: string } {
  const category = categorizeVideoLength(durationSeconds);

  switch (category) {
    case "short":
      return {
        brief: "2-3문장",
        detailed: "5-7문장으로 주요 내용을 포함",
      };
    case "medium":
      return {
        brief: "3-4문장",
        detailed: "10-15문장으로 세부 내용과 예시를 포함",
      };
    case "long":
      return {
        brief: "4-5문장",
        detailed: "20-30문장으로 상세한 내용, 예시, 인사이트를 포함",
      };
  }
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ISO 8601 duration (e.g. PT1H2M10S) → 한국어 표시 (e.g. 1시간 2분 10초) */
export function formatDuration(iso: string | null | undefined): string {
  if (!iso) return "";
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return iso;
  const h = match[1] ? `${match[1]}시간` : "";
  const m = match[2] ? `${match[2]}분` : "";
  const s = match[3] ? `${match[3]}초` : "";
  return [h, m, s].filter(Boolean).join(" ") || "0초";
}

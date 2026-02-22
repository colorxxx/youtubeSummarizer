type LogLevel = "INFO" | "WARN" | "ERROR";

function formatLog(level: LogLevel, prefix: string, msg: string) {
  const ts = new Date().toISOString();
  return `[${ts}] [${level}] [${prefix}] ${msg}`;
}

export function createLogger(prefix: string) {
  return {
    info: (msg: string, ...args: unknown[]) =>
      console.log(formatLog("INFO", prefix, msg), ...args),
    warn: (msg: string, ...args: unknown[]) =>
      console.warn(formatLog("WARN", prefix, msg), ...args),
    error: (msg: string, ...args: unknown[]) =>
      console.error(formatLog("ERROR", prefix, msg), ...args),
  };
}

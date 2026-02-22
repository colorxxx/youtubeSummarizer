export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  deepseekApiUrl: process.env.DEEPSEEK_API_URL ?? "https://api.deepseek.com",
  deepseekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
  tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
};

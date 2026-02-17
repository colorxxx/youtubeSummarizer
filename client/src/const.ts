export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate Google OAuth 2.0 login URL at runtime.
export const getLoginUrl = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  // 항상 localhost를 사용하여 Google Cloud Console 설정과 일치시킴
  const origin = window.location.origin.replace("127.0.0.1", "localhost");
  const redirectUri = `${origin}/api/oauth/callback`;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return url.toString();
};

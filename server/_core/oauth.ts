import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      // Exchange code for access token with Google
      const params = new URLSearchParams({
        code,
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        redirect_uri: `${req.protocol}://${req.get("host")?.replace("127.0.0.1", "localhost")}/api/oauth/callback`,
        grant_type: "authorization_code",
      });

      const tokenResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        }
      );

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("[OAuth] Token exchange failed:", errorText);
        res.status(500).json({ error: "Token exchange failed" });
        return;
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
      };

      // Get user info from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );

      if (!userInfoResponse.ok) {
        console.error("[OAuth] Failed to get user info");
        res.status(500).json({ error: "Failed to get user info" });
        return;
      }

      const userInfo = (await userInfoResponse.json()) as {
        id: string;
        name?: string;
        email?: string;
      };

      if (!userInfo.id) {
        res.status(400).json({ error: "Google user ID missing" });
        return;
      }

      const openId = userInfo.id;

      await db.upsertUser({
        openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: "OAuth callback failed", detail: errorMessage });
    }
  });
}

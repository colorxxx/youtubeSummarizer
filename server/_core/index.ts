import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeCronJobs } from "../cronJobs";
import { handleChatStream } from "../chatStream";
import { createLogger } from "./logger";
import { getVideoTranscript } from "../youtube";

const execFileAsync = promisify(execFile);

const log = createLogger("Server");

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1); // Trust first proxy (Railway)
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Chat streaming SSE endpoint
  app.post("/api/chat/stream", handleChatStream);

  // Temporary diagnostic endpoint for yt-dlp debugging (remove after fix)
  app.get("/api/debug/yt-dlp", async (_req, res) => {
    const results: Record<string, unknown> = {};

    // 1. which yt-dlp
    try {
      const { stdout } = await execFileAsync("which", ["yt-dlp"]);
      results.whichYtDlp = { success: true, path: stdout.trim() };
    } catch (err) {
      results.whichYtDlp = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    // 2. yt-dlp --version
    try {
      const { stdout } = await execFileAsync("yt-dlp", ["--version"]);
      results.ytDlpVersion = { success: true, version: stdout.trim() };
    } catch (err) {
      results.ytDlpVersion = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    // 3. Actual subtitle fetch test
    const testVideoId = "Xlc_ALDWc0Q";
    try {
      const transcript = await getVideoTranscript(testVideoId);
      results.transcriptFetch = {
        success: transcript.available,
        textLength: transcript.text.length,
        preview: transcript.text.substring(0, 200),
      };
    } catch (err) {
      results.transcriptFetch = { success: false, error: err instanceof Error ? err.message : String(err) };
    }

    // 4. Environment info
    results.environment = {
      PATH: process.env.PATH,
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      tmpdir: os.tmpdir(),
    };

    res.json(results);
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    log.warn(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    log.info(`Server running on port ${port}`);

    // Initialize cron jobs after server starts
    initializeCronJobs();
  });
}

startServer().catch(console.error);

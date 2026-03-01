/**
 * Downloads yt-dlp standalone binary using Node.js https module.
 * Used as postinstall script — runs during build phase where the binary persists to runtime.
 * Handles GitHub redirects automatically.
 */
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Use yt-dlp_linux — the standalone binary that doesn't require Python
const YT_DLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
const DEST = path.join(__dirname, "..", "node_modules", ".bin", "yt-dlp");

function download(url, dest, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error("Too many redirects"));

    const client = url.startsWith("https") ? https : http;
    client.get(url, { headers: { "User-Agent": "node" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log(`Redirecting to: ${res.headers.location}`);
        res.resume();
        return download(res.headers.location, dest, maxRedirects - 1).then(resolve, reject);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }

      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => {
        file.close(() => {
          fs.chmodSync(dest, 0o755);
          console.log(`yt-dlp downloaded to ${dest}`);
          resolve();
        });
      });
      file.on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    }).on("error", reject);
  });
}

async function main() {
  console.log(`Downloading yt-dlp from ${YT_DLP_URL}...`);
  try {
    await download(YT_DLP_URL, DEST);
    console.log("yt-dlp installation complete.");
  } catch (err) {
    console.error("Failed to download yt-dlp:", err.message);
    process.exit(1);
  }
}

main();

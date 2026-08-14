// Minimal static file server with SPA fallback, used by `npm run preview`.
// Also usable for the final static deployment (serves dist/).
import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { networkInterfaces } from "node:os";

const root = process.env.DIST_DIR || join(process.cwd(), "dist");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

const server = createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  let filePath = normalize(join(root, urlPath === "/" ? "index.html" : urlPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  const hasExtension = extname(urlPath) !== "";
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    // Prefer <dir>/index.html when the request is a directory (e.g. sub-path deploy).
    const dirIndex = join(filePath, "index.html");
    if (existsSync(dirIndex) && statSync(dirIndex).isFile()) {
      filePath = dirIndex;
    } else {
      // SPA fallback only for route-like (extensionless) paths; missing
      // assets should 404 instead of returning HTML with the wrong MIME type.
      if (hasExtension) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      filePath = join(root, "index.html");
    }
  }
  res.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
  createReadStream(filePath).pipe(res);
});

server.listen(port, host, () => {
  console.log(`[serve-static] 静态站点已启动  (root: ${root})`);
  console.log(`  本机访问: http://localhost:${port}`);
  const addrs = new Set();
  for (const infos of Object.values(networkInterfaces())) {
    for (const info of infos || []) {
      if (info.family === "IPv4" && !info.internal) addrs.add(info.address);
    }
  }
  for (const addr of addrs) {
    console.log(`  局域网访问: http://${addr}:${port}`);
  }
});

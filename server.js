import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3035);
const PUBLIC_DIR = path.join(__dirname, "public");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Content-Length":Buffer.byteLength(body),"Cache-Control":"no-store"});
  res.end(body);
}

function sendText(res, status, text, type = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type, "Content-Length": Buffer.byteLength(text) });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1000000) { reject(new Error("Payload too large")); req.destroy(); }
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function serveStatic(res, pathname) {
  let safePath = pathname;
  if (safePath === "/") safePath = "/index.html";
  if (safePath === "/app") safePath = "/app.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendText(res, 403, "Forbidden");
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendText(res, 404, "Not found");
  const ext = path.extname(filePath).toLowerCase();
  const type = ext === ".html" ? "text/html; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : ext === ".js" ? "application/javascript; charset=utf-8" : "application/octet-stream";
  res.writeHead(200, { "Content-Type": type });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") return sendJson(res, 200, { ok: true, service: "first-love-app", anthropicConfigured: Boolean(ANTHROPIC_API_KEY), model: ANTHROPIC_MODEL });
  if (req.method === "POST" && pathname === "/api/chat") {
    if (!ANTHROPIC_API_KEY) return sendJson(res, 500, { ok: false, error: "ANTHROPIC_API_KEY manquante sur le serveur." });
    const body = await readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const system = String(body.system || "");
    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {"content-type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01"},
        body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 300, system, messages })
      });
      const data = await upstream.json();
      if (!upstream.ok) return sendJson(res, upstream.status, { ok: false, error: data?.error?.message || "Erreur Anthropic", raw: data });
      const reply = data?.content?.find?.(item => item?.type === "text")?.text || data?.content?.[0]?.text || "...";
      return sendJson(res, 200, { ok: true, reply, raw: data });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error.message });
    }
  }
  return sendJson(res, 404, { error: "Route API introuvable" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) return handleApi(req, res, url.pathname);
    return serveStatic(res, url.pathname);
  } catch (error) {
    return sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, "0.0.0.0", () => { console.log(`First Love local sur http://0.0.0.0:${PORT}`); });

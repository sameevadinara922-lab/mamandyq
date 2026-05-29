const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT) || 8080;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "data", "college.db");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    major TEXT,
    source TEXT DEFAULT 'college-landing-form',
    created_at TEXT NOT NULL
  );
`);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(ROOT, rel));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

async function handleApi(req, res) {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  if (req.url === "/api/applications" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || "{}");
      const fullName = String(body.fullName || "").trim();
      const phone = String(body.phone || "").trim();
      const major = String(body.major || "").trim();
      const source = String(body.source || "college-landing-form").trim();

      if (!fullName || !phone) {
        sendJson(res, 400, { ok: false, message: "Аты-жөні мен телефон міндетті." });
        return;
      }

      const createdAt = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO applications (full_name, phone, major, source, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(fullName, phone, major, source, createdAt);

      sendJson(res, 201, {
        ok: true,
        id: Number(result.lastInsertRowid),
        message: "Өтініш базаға сақталды.",
      });
    } catch (error) {
      sendJson(res, 500, { ok: false, message: "Сервер қатесі." });
    }
    return;
  }

  if (req.url === "/api/applications" && req.method === "GET") {
    const rows = db
      .prepare(
        `SELECT id, full_name, phone, major, source, created_at
         FROM applications
         ORDER BY id DESC
         LIMIT 500`
      )
      .all();
    sendJson(res, 200, { ok: true, items: rows });
    return;
  }

  sendJson(res, 404, { ok: false, message: "API табылмады." });
}

const server = http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Сервер іске қосылды: http://127.0.0.1:${PORT}`);
  console.log(`База файлы: ${DB_PATH}`);
  console.log(`Өтініштер тізімі: http://127.0.0.1:${PORT}/admin.html`);
});

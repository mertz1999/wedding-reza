import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number.parseInt(process.env.PORT || "4173", 10);
const dataDirectory = join(root, "data");
mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(join(dataDirectory, "wedding.sqlite"));
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT NOT NULL UNIQUE,
    guest_name TEXT NOT NULL,
    phone TEXT,
    created_at TEXT NOT NULL,
    first_viewed_at TEXT,
    last_viewed_at TEXT,
    view_count INTEGER NOT NULL DEFAULT 0,
    first_card_opened_at TEXT,
    last_card_opened_at TEXT,
    card_open_count INTEGER NOT NULL DEFAULT 0,
    rsvp_status TEXT CHECK (rsvp_status IN ('yes', 'no')),
    rsvp_updated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
`);

const statements = {
  list: database.prepare(`SELECT * FROM invitations ORDER BY id DESC`),
  find: database.prepare(`SELECT * FROM invitations WHERE token = ?`),
  insert: database.prepare(`INSERT INTO invitations (token, guest_name, phone, created_at) VALUES (?, ?, ?, ?)`),
  viewed: database.prepare(`
    UPDATE invitations SET
      first_viewed_at = COALESCE(first_viewed_at, ?),
      last_viewed_at = ?,
      view_count = view_count + 1
    WHERE token = ?
  `),
  opened: database.prepare(`
    UPDATE invitations SET
      first_card_opened_at = COALESCE(first_card_opened_at, ?),
      last_card_opened_at = ?,
      card_open_count = card_open_count + 1
    WHERE token = ?
  `),
  rsvp: database.prepare(`UPDATE invitations SET rsvp_status = ?, rsvp_updated_at = ? WHERE token = ?`),
  remove: database.prepare(`DELETE FROM invitations WHERE id = ?`),
};

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".mp3", "audio/mpeg"],
  [".ico", "image/x-icon"],
]);

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

function isLocalAdminRequest(request) {
  const host = (request.headers.host || "").toLowerCase().replace(/^\[|\]$/g, "").split(":")[0];
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 32_768) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function cleanText(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function serializeInvitation(row, includePrivate = false) {
  const invitation = {
    id: row.id,
    token: row.token,
    guestName: row.guest_name,
    createdAt: row.created_at,
    firstViewedAt: row.first_viewed_at,
    lastViewedAt: row.last_viewed_at,
    viewCount: row.view_count,
    firstCardOpenedAt: row.first_card_opened_at,
    lastCardOpenedAt: row.last_card_opened_at,
    cardOpenCount: row.card_open_count,
    rsvpStatus: row.rsvp_status,
    rsvpUpdatedAt: row.rsvp_updated_at,
  };
  if (includePrivate) invitation.phone = row.phone;
  return invitation;
}

function serveFile(response, pathname) {
  let requested = pathname;
  if (requested === "/") requested = "/index.html";
  if (requested === "/admin" || requested === "/admin/") requested = "/admin.html";
  if (/^\/i\/[A-Za-z0-9_-]+\/?$/.test(requested)) requested = "/index.html";

  const relative = normalize(decodeURIComponent(requested)).replace(/^([/\\])+/, "");
  const topLevel = relative.split(/[/\\]/)[0].toLowerCase();
  if (topLevel === "data" || topLevel === ".tools" || topLevel === ".git") {
    sendError(response, 404, "فایل پیدا نشد.");
    return;
  }
  const filePath = resolve(root, relative);
  const rootPrefix = resolve(root).replace(/[\\/]$/, "") + "\\";
  if (!filePath.startsWith(rootPrefix) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    sendError(response, 404, "فایل پیدا نشد.");
    return;
  }

  const type = mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": type.startsWith("text/") || type.includes("javascript") ? "no-cache" : "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
  });
  createReadStream(filePath).pipe(response);
}

async function handleApi(request, response, pathname) {
  if (pathname.startsWith("/api/admin/")) {
    if (!isLocalAdminRequest(request)) {
      sendError(response, 403, "پنل مدیریت فقط روی همین رایانه در دسترس است.");
      return;
    }

    if (pathname === "/api/admin/invitations" && request.method === "GET") {
      sendJson(response, 200, { invitations: statements.list.all().map((row) => serializeInvitation(row, true)) });
      return;
    }

    if (pathname === "/api/admin/invitations" && request.method === "POST") {
      const body = await readJson(request);
      const guestName = cleanText(body.guestName, 120);
      const phone = cleanText(body.phone, 32) || null;
      if (!guestName) {
        sendError(response, 400, "نام مهمان الزامی است.");
        return;
      }
      const token = randomBytes(18).toString("base64url");
      statements.insert.run(token, guestName, phone, new Date().toISOString());
      sendJson(response, 201, { invitation: serializeInvitation(statements.find.get(token), true) });
      return;
    }

    const deleteMatch = pathname.match(/^\/api\/admin\/invitations\/(\d+)$/);
    if (deleteMatch && request.method === "DELETE") {
      const result = statements.remove.run(Number(deleteMatch[1]));
      if (!result.changes) {
        sendError(response, 404, "مهمان پیدا نشد.");
        return;
      }
      response.writeHead(204);
      response.end();
      return;
    }

    sendError(response, 404, "مسیر مدیریتی پیدا نشد.");
    return;
  }

  const inviteMatch = pathname.match(/^\/api\/invitations\/([A-Za-z0-9_-]+)(?:\/(open|rsvp))?$/);
  if (!inviteMatch) {
    sendError(response, 404, "مسیر API پیدا نشد.");
    return;
  }

  const [, token, action] = inviteMatch;
  const existing = statements.find.get(token);
  if (!existing) {
    sendError(response, 404, "دعوت‌نامه پیدا نشد.");
    return;
  }

  if (!action && request.method === "GET") {
    const now = new Date().toISOString();
    statements.viewed.run(now, now, token);
    sendJson(response, 200, { invitation: serializeInvitation(statements.find.get(token)) });
    return;
  }

  if (action === "open" && request.method === "POST") {
    const now = new Date().toISOString();
    statements.opened.run(now, now, token);
    sendJson(response, 200, { invitation: serializeInvitation(statements.find.get(token)) });
    return;
  }

  if (action === "rsvp" && request.method === "POST") {
    const body = await readJson(request);
    if (body.response !== "yes" && body.response !== "no") {
      sendError(response, 400, "پاسخ حضور معتبر نیست.");
      return;
    }
    statements.rsvp.run(body.response, new Date().toISOString(), token);
    sendJson(response, 200, { invitation: serializeInvitation(statements.find.get(token)) });
    return;
  }

  sendError(response, 405, "این عملیات پشتیبانی نمی‌شود.");
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    const pathname = url.pathname;
    const decodedPathname = decodeURIComponent(pathname);

    if ((decodedPathname === "/admin" || decodedPathname === "/admin/" || decodedPathname === "/admin.html" || decodedPathname === "/admin.css" || decodedPathname === "/admin.js") && !isLocalAdminRequest(request)) {
      sendError(response, 403, "پنل مدیریت فقط روی همین رایانه در دسترس است.");
      return;
    }

    if (pathname.startsWith("/api/")) {
      await handleApi(request, response, pathname);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendError(response, 405, "این عملیات پشتیبانی نمی‌شود.");
      return;
    }
    serveFile(response, pathname);
  } catch (error) {
    if (error instanceof SyntaxError) sendError(response, 400, "اطلاعات ارسالی معتبر نیست.");
    else if (error?.message === "PAYLOAD_TOO_LARGE") sendError(response, 413, "حجم اطلاعات ارسالی زیاد است.");
    else {
      console.error(error);
      sendError(response, 500, "خطای داخلی سرور.");
    }
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Wedding invitation: http://localhost:${port}/`);
  console.log(`Guest manager: http://localhost:${port}/admin`);
});

function close() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", close);
process.on("SIGTERM", close);

import { createServer } from "node:http";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number.parseInt(process.env.PORT || "4173", 10);
const host = process.env.HOST?.trim() || "127.0.0.1";
const adminUsername = process.env.ADMIN_USERNAME?.trim() || "";
const adminPassword = process.env.ADMIN_PASSWORD || "";
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
    include_companions INTEGER NOT NULL DEFAULT 1 CHECK (include_companions IN (0, 1)),
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

const invitationColumns = database.prepare("PRAGMA table_info(invitations)").all();
if (!invitationColumns.some((column) => column.name === "include_companions")) {
  database.exec("ALTER TABLE invitations ADD COLUMN include_companions INTEGER NOT NULL DEFAULT 1 CHECK (include_companions IN (0, 1))");
}

const statements = {
  list: database.prepare(`SELECT * FROM invitations ORDER BY id DESC`),
  find: database.prepare(`SELECT * FROM invitations WHERE token = ?`),
  findById: database.prepare(`SELECT * FROM invitations WHERE id = ?`),
  insert: database.prepare(`INSERT INTO invitations (token, guest_name, phone, include_companions, created_at) VALUES (?, ?, ?, ?, ?)`),
  update: database.prepare(`UPDATE invitations SET guest_name = ?, phone = ?, include_companions = ? WHERE id = ?`),
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

function isLoopbackHost(value) {
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function hasRemoteAdminCredentials() {
  return Boolean(adminUsername && adminPassword);
}

function isLocalAdminRequest(request) {
  if (!isLoopbackHost(host)) return false;
  const requestedHost = (request.headers.host || "").toLowerCase().replace(/^\[|\]$/g, "").split(":")[0];
  return isLoopbackHost(requestedHost);
}

function isAuthorizedAdminRequest(request) {
  if (isLocalAdminRequest(request)) return true;
  if (!hasRemoteAdminCredentials()) return false;

  const authorization = request.headers.authorization || "";
  const match = authorization.match(/^Basic\s+(.+)$/i);
  if (!match) return false;

  let decoded;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return false;
  }
  const separator = decoded.indexOf(":");
  if (separator < 0) return false;
  return safeEqual(decoded.slice(0, separator), adminUsername)
    && safeEqual(decoded.slice(separator + 1), adminPassword);
}

function sendAdminDenied(response) {
  if (!hasRemoteAdminCredentials()) {
    sendError(response, 403, "برای دسترسی راه دور به پنل مدیریت، نام کاربری و رمز عبور مدیر را تنظیم کنید.");
    return;
  }

  const body = Buffer.from(JSON.stringify({ error: "نام کاربری یا رمز عبور مدیریت صحیح نیست." }));
  response.writeHead(401, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
    "WWW-Authenticate": 'Basic realm="Wedding Admin", charset="UTF-8"',
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
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
    includeCompanions: row.include_companions !== 0,
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
  const rootPrefix = resolve(root).replace(/[\\/]$/, "") + sep;
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
    if (!isAuthorizedAdminRequest(request)) {
      sendAdminDenied(response);
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
      const includeCompanions = body.includeCompanions !== false ? 1 : 0;
      if (!guestName) {
        sendError(response, 400, "نام مهمان الزامی است.");
        return;
      }
      const token = randomBytes(18).toString("base64url");
      statements.insert.run(token, guestName, phone, includeCompanions, new Date().toISOString());
      sendJson(response, 201, { invitation: serializeInvitation(statements.find.get(token), true) });
      return;
    }

    const updateMatch = pathname.match(/^\/api\/admin\/invitations\/(\d+)$/);
    if (updateMatch && request.method === "PATCH") {
      const id = Number(updateMatch[1]);
      if (!statements.findById.get(id)) {
        sendError(response, 404, "مهمان پیدا نشد.");
        return;
      }
      const body = await readJson(request);
      const guestName = cleanText(body.guestName, 120);
      const phone = cleanText(body.phone, 32) || null;
      const includeCompanions = body.includeCompanions !== false ? 1 : 0;
      if (!guestName) {
        sendError(response, 400, "نام مهمان الزامی است.");
        return;
      }
      statements.update.run(guestName, phone, includeCompanions, id);
      sendJson(response, 200, { invitation: serializeInvitation(statements.findById.get(id), true) });
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

    if (pathname === "/healthz") {
      const body = Buffer.from("ok\n");
      response.writeHead(200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
      });
      if (request.method !== "HEAD") response.end(body);
      else response.end();
      return;
    }

    if ((decodedPathname === "/admin" || decodedPathname === "/admin/" || decodedPathname === "/admin.html" || decodedPathname === "/admin.css" || decodedPathname === "/admin.js") && !isAuthorizedAdminRequest(request)) {
      sendAdminDenied(response);
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

server.listen(port, host, () => {
  console.log(`Wedding invitation listening on http://${host}:${port}/`);
  console.log(`Guest manager: http://${host}:${port}/admin`);
});

function close() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", close);
process.on("SIGTERM", close);

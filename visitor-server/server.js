// Birthday-site visitor server - zero npm dependencies (Node 22+).
//   POST /api/visit       a page was opened
//   POST /api/heartbeat   "still here" ping with active seconds
//   POST /api/location    result of the browser's location prompt
//   GET  /admin           private dashboard (login required)
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.js";
import { parseUA } from "./ua.js";
import { lookupGeo, isPrivateIp } from "./geo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ---------------- config (from .env or real environment variables) ---------------- */
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
loadEnv(path.join(__dirname, ".env"));

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const isProd = process.env.NODE_ENV === "production";
const cfg = {
  port: +process.env.PORT || 3000,
  isProd,
  adminUser: process.env.ADMIN_USER || "admin",
  adminPass: process.env.ADMIN_PASSWORD || "",
  origins: (process.env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim().replace(/\/$/, "")).filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === "true",
  proxyHops: clamp(+process.env.PROXY_HOPS || 1, 1, 5),
  ipMode: process.env.IP_MODE === "hashed" ? "hashed" : "raw",
  ipSalt: process.env.IP_SALT || "change-me",
  dbPath: path.resolve(__dirname, process.env.DB_PATH || "data/visitors.db"),
  geoLookup: process.env.GEO_LOOKUP !== "false",
  gpsDecimals: clamp(process.env.GPS_DECIMALS === undefined ? 5 : +process.env.GPS_DECIMALS, 0, 6),
  siteDir: process.env.SITE_DIR === undefined ? (isProd ? "" : "../birthday-site") : process.env.SITE_DIR
};
if (!cfg.adminPass) {
  if (isProd) { console.error("ADMIN_PASSWORD is required in production."); process.exit(1); }
  cfg.adminPass = crypto.randomBytes(9).toString("base64url");
  console.log(`\n[!] ADMIN_PASSWORD not set. Temporary login  ->  ${cfg.adminUser} / ${cfg.adminPass}\n`);
}
const siteRoot = cfg.siteDir ? path.resolve(__dirname, cfg.siteDir) : "";

/* ---------------- database ---------------- */
const db = openDb(cfg.dbPath);
const q = {
  insertVisit: db.prepare(`INSERT OR IGNORE INTO visits
    (id, visitor_id, started_at, last_seen_at, ip, user_agent, browser, os, device_type, device_model,
     screen, viewport, language, timezone, referrer, landing, is_bot)
    VALUES (:id, :visitor_id, :now, :now, :ip, :ua, :browser, :os, :device_type, :device_model,
     :screen, :viewport, :language, :timezone, :referrer, :landing, :is_bot)`),
  getVisit: db.prepare("SELECT visitor_id, started_at FROM visits WHERE id = ?"),
  heartbeat: db.prepare(`UPDATE visits SET duration_sec = MAX(duration_sec, :dur), pages = :pages, last_seen_at = :now WHERE id = :id`),
  setIpGeo: db.prepare(`UPDATE visits SET country = :country, region = :region, city = :city, isp = :isp,
    ip_lat = :lat, ip_lng = :lng WHERE id = :id`),
  setGeo: db.prepare(`UPDATE visits SET geo_status = :status, lat = :lat, lng = :lng, accuracy = :acc, geo_at = :now,
    last_seen_at = :now WHERE id = :id`)
};

/* ---------------- small helpers ---------------- */
const txt = (v, n = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);
const int = v => (Number.isFinite(+v) ? Math.trunc(+v) : 0);
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const okId = v => (typeof v === "string" && ID_RE.test(v) ? v : null);
const PAGES = ["home", "balloons", "cake", "photos", "wishes", "letter"];
const sha = s => crypto.createHash("sha256").update(s).digest();

function json(res, code, obj, headers = {}) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(obj));
}

function clientIp(req) {
  const h = req.headers;
  let ip = null;
  if (cfg.trustProxy) {
    if (h["cf-connecting-ip"]) ip = String(h["cf-connecting-ip"]).trim();
    else if (h["x-forwarded-for"]) {
      // The right-most entries are added by OUR proxies; the left-most can be faked by the visitor.
      const list = String(h["x-forwarded-for"]).split(",").map(s => s.trim()).filter(Boolean);
      ip = list[Math.max(0, list.length - cfg.proxyHops)];
    }
  }
  ip = (ip || req.socket.remoteAddress || "").replace(/^::ffff:/, "");
  return ip.slice(0, 64);
}
const storedIp = ip => (cfg.ipMode === "hashed"
  ? crypto.createHmac("sha256", cfg.ipSalt).update(ip).digest("hex").slice(0, 16) : ip);

const hits = new Map();
function limited(key, max) {
  const now = Date.now();
  let e = hits.get(key);
  if (!e || e.reset < now) { e = { n: 0, reset: now + 60_000 }; hits.set(key, e); }
  return ++e.n > max;
}
setInterval(() => { const n = Date.now(); for (const [k, v] of hits) if (v.reset < n) hits.delete(k); }, 60_000).unref();

/** null = blocked origin, {} = no CORS needed, {...} = headers to send */
function corsFor(req) {
  const o = req.headers.origin;
  if (!o) return {};
  let allowed = cfg.origins.includes(o.replace(/\/$/, ""));
  try { if (new URL(o).host === req.headers.host) allowed = true; } catch { return null; }
  if (!cfg.isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) allowed = true;
  if (!allowed) return null;
  return {
    "Access-Control-Allow-Origin": o, "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function readJson(req, limit = 8192) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => {
      size += c.length;
      if (size > limit) { reject(new Error("too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const o = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        if (o && typeof o === "object" && !Array.isArray(o)) resolve(o); else reject(new Error("not an object"));
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

/* ---------------- tracking endpoints ---------------- */
function handleVisit(req, res, body, ip, ch) {
  const visitorId = okId(body.visitorId), visitId = okId(body.visitId);
  if (!visitorId || !visitId) return json(res, 400, { error: "bad id" }, ch);

  const ua = req.headers["user-agent"] || "";
  const p = parseUA(ua);
  const screen = /^\d{2,5}x\d{2,5}$/.test(body.screen || "") ? body.screen : null;
  const viewport = /^\d{2,5}x\d{2,5}$/.test(body.viewport || "") ? body.viewport : null;

  q.insertVisit.run({
    id: visitId, visitor_id: visitorId, now: Date.now(), ip: storedIp(ip) || null, ua: ua.slice(0, 400),
    browser: p.browser, os: p.os, device_type: p.deviceType, device_model: p.deviceModel,
    screen, viewport, language: txt(body.language, 20), timezone: txt(body.timezone, 60),
    referrer: txt(body.referrer, 300), landing: txt(body.page, 20), is_bot: p.isBot ? 1 : 0
  });
  json(res, 200, { ok: true }, ch);

  // approximate place from the IP - done after replying so the site never waits for it
  if (cfg.geoLookup && !p.isBot && !isPrivateIp(ip)) {
    lookupGeo(db, ip, storedIp(ip)).then(g => {
      if (g) q.setIpGeo.run({ id: visitId, country: g.country, region: g.region, city: g.city, isp: g.isp, lat: g.lat, lng: g.lng });
    }).catch(() => { /* lookup service down - ignore */ });
  }
}

function handleHeartbeat(res, body, ch) {
  const visitorId = okId(body.visitorId), visitId = okId(body.visitId);
  if (!visitorId || !visitId) return json(res, 400, { error: "bad id" }, ch);
  const row = q.getVisit.get(visitId);
  if (!row || row.visitor_id !== visitorId) return json(res, 404, { error: "unknown visit" }, ch);

  const now = Date.now();
  const maxPossible = Math.floor((now - row.started_at) / 1000) + 5;      // can't be active longer than the visit lasted
  const dur = clamp(int(body.active), 0, Math.min(maxPossible, 6 * 3600));
  const pages = {};
  if (body.pages && typeof body.pages === "object") {
    for (const k of PAGES) if (k in body.pages) pages[k] = clamp(int(body.pages[k]), 0, 6 * 3600);
  }
  q.heartbeat.run({ id: visitId, dur, pages: JSON.stringify(pages), now });
  json(res, 200, { ok: true }, ch);
}

function handleLocation(res, body, ch) {
  const visitorId = okId(body.visitorId), visitId = okId(body.visitId);
  if (!visitorId || !visitId) return json(res, 400, { error: "bad id" }, ch);
  const row = q.getVisit.get(visitId);
  if (!row || row.visitor_id !== visitorId) return json(res, 404, { error: "unknown visit" }, ch);

  const status = ["granted", "denied", "unavailable", "timeout"].includes(body.status) ? body.status : null;
  if (!status) return json(res, 400, { error: "bad status" }, ch);

  let lat = null, lng = null, acc = null;
  if (status === "granted") {
    lat = Number(body.lat); lng = Number(body.lng); acc = Number(body.accuracy);
    if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return json(res, 400, { error: "bad coordinates" }, ch);
    const f = 10 ** cfg.gpsDecimals;
    lat = Math.round(lat * f) / f; lng = Math.round(lng * f) / f;
    acc = Number.isFinite(acc) && acc >= 0 ? Math.min(Math.round(acc), 1_000_000) : null;
  }
  q.setGeo.run({ id: visitId, status, lat, lng, acc, now: Date.now() });
  json(res, 200, { ok: true }, ch);
}

async function api(req, res, p) {
  const ch = corsFor(req);
  if (ch === null) return json(res, 403, { error: "origin not allowed" });
  if (req.method === "OPTIONS") { res.writeHead(204, ch); return res.end(); }
  if (req.method !== "POST") return json(res, 405, { error: "POST only" }, ch);

  const ip = clientIp(req);
  if (limited("api:" + ip, 240)) return json(res, 429, { error: "slow down" }, ch);

  let body;
  try { body = await readJson(req); } catch { return json(res, 400, { error: "bad body" }, ch); }

  if (p === "/api/visit") return handleVisit(req, res, body, ip, ch);
  if (p === "/api/heartbeat") return handleHeartbeat(res, body, ch);
  if (p === "/api/location") return handleLocation(res, body, ch);
  return json(res, 404, { error: "not found" }, ch);
}

/* ---------------- private dashboard ---------------- */
function safeEq(a, b) { return crypto.timingSafeEqual(sha(a), sha(b)); }

function authOk(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const decoded = Buffer.from(h.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const userOk = safeEq(decoded.slice(0, i), cfg.adminUser);
  const passOk = safeEq(decoded.slice(i + 1), cfg.adminPass);
  return userOk && passOk;
}

function stats(tzOffsetMin) {
  const now = Date.now();
  const one = (sql, params = {}) => db.prepare(sql).get(params);
  const all = (sql, params = {}) => db.prepare(sql).all(params);

  const totals = one(`SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors,
      COALESCE(SUM(duration_sec), 0) AS seconds,
      COALESCE(SUM(CASE WHEN started_at > :since THEN 1 ELSE 0 END), 0) AS last24h,
      COALESCE(SUM(CASE WHEN geo_status = 'granted' THEN 1 ELSE 0 END), 0) AS gps_granted,
      COALESCE(SUM(CASE WHEN geo_status = 'denied' THEN 1 ELSE 0 END), 0) AS gps_denied
    FROM visits WHERE is_bot = 0`, { since: now - 864e5 });
  totals.returning = one(`SELECT COUNT(*) AS c FROM (SELECT visitor_id FROM visits WHERE is_bot = 0
      GROUP BY visitor_id HAVING COUNT(*) > 1)`).c;
  totals.bots = one("SELECT COUNT(*) AS c FROM visits WHERE is_bot = 1").c;

  // one row per visitor; location column prefers a visit where GPS was allowed
  const visitors = all(`SELECT a.visitor_id, a.visits, a.first_seen, a.last_seen, a.seconds,
      v.ip, v.city, v.region, v.country, v.device_type, v.device_model, v.browser, v.os,
      (SELECT g.geo_status FROM visits g WHERE g.visitor_id = a.visitor_id AND g.is_bot = 0
         ORDER BY (g.geo_status = 'granted') DESC, g.started_at DESC LIMIT 1) AS geo_status,
      (SELECT g.lat FROM visits g WHERE g.visitor_id = a.visitor_id AND g.geo_status = 'granted' AND g.lat IS NOT NULL
         ORDER BY g.geo_at DESC LIMIT 1) AS lat,
      (SELECT g.lng FROM visits g WHERE g.visitor_id = a.visitor_id AND g.geo_status = 'granted' AND g.lat IS NOT NULL
         ORDER BY g.geo_at DESC LIMIT 1) AS lng
    FROM (SELECT visitor_id, COUNT(*) AS visits, MIN(started_at) AS first_seen, MAX(started_at) AS last_seen,
                 SUM(duration_sec) AS seconds
          FROM visits WHERE is_bot = 0 GROUP BY visitor_id) a
    JOIN visits v ON v.visitor_id = a.visitor_id AND v.started_at = a.last_seen AND v.is_bot = 0
    GROUP BY a.visitor_id ORDER BY a.last_seen DESC LIMIT 100`);

  const group = col => all(`SELECT COALESCE(${col}, 'Unknown') AS name, COUNT(*) AS visits,
      COUNT(DISTINCT visitor_id) AS visitors FROM visits WHERE is_bot = 0
      GROUP BY 1 ORDER BY visits DESC LIMIT 8`);

  const days = all(`SELECT strftime('%Y-%m-%d', started_at / 1000 + :off * 60, 'unixepoch') AS day,
      COUNT(*) AS visits, COUNT(DISTINCT visitor_id) AS visitors FROM visits
    WHERE is_bot = 0 AND started_at > :since GROUP BY day ORDER BY day`, { off: tzOffsetMin, since: now - 15 * 864e5 });

  const pageTotals = {}, pageCounts = {};
  for (const r of all("SELECT pages FROM visits WHERE is_bot = 0 ORDER BY started_at DESC LIMIT 1000")) {
    let o; try { o = JSON.parse(r.pages); } catch { continue; }
    for (const k of PAGES) if (o[k] > 0) { pageTotals[k] = (pageTotals[k] || 0) + o[k]; pageCounts[k] = (pageCounts[k] || 0) + 1; }
  }
  const pageTimes = PAGES.map(k => ({ page: k, avg: pageCounts[k] ? Math.round(pageTotals[k] / pageCounts[k]) : 0, views: pageCounts[k] || 0 }));

  const recent = all(`SELECT id, visitor_id, started_at, duration_sec, ip, city, region, country, device_type,
      device_model, browser, os, referrer, geo_status, lat, lng, accuracy
    FROM visits WHERE is_bot = 0 ORDER BY started_at DESC LIMIT 40`);

  const gps = all(`SELECT visitor_id, lat, lng, accuracy, geo_at FROM visits
    WHERE geo_status = 'granted' AND lat IS NOT NULL ORDER BY geo_at DESC LIMIT 300`);
  const ipPoints = all(`SELECT visitor_id, ip_lat AS lat, ip_lng AS lng, city, country FROM visits
    WHERE is_bot = 0 AND ip_lat IS NOT NULL ORDER BY started_at DESC LIMIT 300`);

  return {
    generatedAt: now, ipMode: cfg.ipMode, totals, visitors, days, pageTimes, recent, gps, ipPoints,
    breakdown: {
      device: group("device_type"), browser: group("browser"), os: group("os"),
      country: group("country"), city: group("city"), gps: group("geo_status")
    }
  };
}

function csv() {
  const rows = db.prepare(`SELECT datetime(started_at / 1000, 'unixepoch') AS started_utc, visitor_id, duration_sec,
      ip, country, region, city, isp, browser, os, device_type, device_model, screen, language, timezone, referrer,
      geo_status, lat, lng, accuracy, pages FROM visits WHERE is_bot = 0 ORDER BY started_at`).all();
  if (!rows.length) return "no visits yet\n";
  const cols = Object.keys(rows[0]);
  // prefix risky first characters so spreadsheets don't run visitor-supplied text as a formula
  const cell = v => {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = "'" + s;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => cell(r[c])).join(","))].join("\n") + "\n";
}

const ADMIN_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
  "img-src 'self' data: https://tile.openstreetmap.org https://cdnjs.cloudflare.com; connect-src 'self'";

async function admin(req, res, url) {
  const ip = clientIp(req);
  if (limited("auth:" + ip, 30)) return json(res, 429, { error: "too many attempts, wait a minute" });
  if (!authOk(req)) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Visitor dashboard", charset="UTF-8"', "Cache-Control": "no-store" });
    return res.end("Login required");
  }
  const sec = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };

  if (url.pathname === "/admin" || url.pathname === "/admin/") {
    const html = await fsp.readFile(path.join(__dirname, "dashboard.html"));
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": ADMIN_CSP, ...sec });
    return res.end(html);
  }
  if (url.pathname === "/admin/api/stats") {
    const tz = clamp(int(url.searchParams.get("tz")), -840, 840);
    return json(res, 200, stats(-tz), sec);   // browser's getTimezoneOffset() is negative of the real offset
  }
  if (url.pathname === "/admin/export.csv") {
    res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="visits.csv"', ...sec });
    return res.end(csv());
  }
  return json(res, 404, { error: "not found" }, sec);
}

/* ---------------- optional: serve the website itself (local testing) ---------------- */
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ico": "image/x-icon", ".txt": "text/plain"
};
async function serveStatic(req, res, pathname) {
  if (!siteRoot || !["GET", "HEAD"].includes(req.method)) return false;
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return false; }
  if (rel.endsWith("/")) rel += "index.html";
  const file = path.normalize(path.join(siteRoot, rel));
  if (!file.startsWith(siteRoot + path.sep) || file.split(path.sep).some(s => s.startsWith("."))) return false;
  try {
    const st = await fsp.stat(file);
    if (!st.isFile()) return false;
    res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream", "Content-Length": st.size });
    if (req.method === "HEAD") return res.end(), true;
    fs.createReadStream(file).pipe(res);
    return true;
  } catch { return false; }
}

/* ---------------- server ---------------- */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const p = url.pathname;
    if (p.startsWith("/api/")) return await api(req, res, p);
    if (p === "/admin" || p.startsWith("/admin/")) return await admin(req, res, url);
    if (p === "/health") return json(res, 200, { ok: true });
    if (await serveStatic(req, res, p)) return;
    json(res, 404, { error: "not found" });
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, 500, { error: "server error" });
    else res.end();
  }
});
server.requestTimeout = 15_000;
server.listen(cfg.port, () => {
  console.log(`Visitor server running on http://localhost:${cfg.port}`);
  console.log(`  dashboard : http://localhost:${cfg.port}/admin   (user: ${cfg.adminUser})`);
  console.log(`  database  : ${cfg.dbPath}`);
  console.log(`  IP mode   : ${cfg.ipMode}   | IP->city lookup: ${cfg.geoLookup ? "on" : "off"}   | proxy trusted: ${cfg.trustProxy}`);
  console.log(`  allowed origins: ${cfg.origins.join(", ") || "(same-origin" + (cfg.isProd ? " only)" : " + localhost)")}`);
  if (siteRoot) console.log(`  also serving website from: ${siteRoot}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { server.close(); try { db.close(); } catch {} process.exit(0); });
}

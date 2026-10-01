// Approximate location from an IP address (city / region / country / provider).
// Uses the free https://ipwho.is service and caches every answer for 30 days.
import net from "node:net";

export function isPrivateIp(ip) {
  if (!ip || !net.isIP(ip)) return true;
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) ||
           (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === "::1" || l === "::" || l.startsWith("fe80") || l.startsWith("fc") || l.startsWith("fd");
}

export async function lookupGeo(db, ip, cacheKey) {
  const row = db.prepare("SELECT data, fetched_at FROM geo_cache WHERE key = ?").get(cacheKey);
  if (row && Date.now() - row.fetched_at < 30 * 864e5) return JSON.parse(row.data);

  const res = await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(4000) });
  const j = await res.json();
  if (!j || !j.success) return null;

  const g = {
    country: j.country || null,
    region: j.region || null,
    city: j.city || null,
    lat: typeof j.latitude === "number" ? j.latitude : null,
    lng: typeof j.longitude === "number" ? j.longitude : null,
    isp: (j.connection && (j.connection.isp || j.connection.org)) || null
  };
  db.prepare("INSERT OR REPLACE INTO geo_cache (key, data, fetched_at) VALUES (?, ?, ?)")
    .run(cacheKey, JSON.stringify(g), Date.now());
  return g;
}

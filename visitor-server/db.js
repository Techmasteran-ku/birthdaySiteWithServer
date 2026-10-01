// SQLite storage using Node's built-in "node:sqlite" (no npm packages needed).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export function openDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    -- one row per page load ("visit"). Several visits can belong to the same visitor_id.
    CREATE TABLE IF NOT EXISTS visits (
      id            TEXT PRIMARY KEY,
      visitor_id    TEXT NOT NULL,
      started_at    INTEGER NOT NULL,          -- ms since epoch
      last_seen_at  INTEGER NOT NULL,
      duration_sec  INTEGER NOT NULL DEFAULT 0, -- active (tab visible) seconds
      pages         TEXT NOT NULL DEFAULT '{}', -- {"home":12,"balloons":40,...} seconds per page

      ip            TEXT,                       -- raw or hashed, see IP_MODE
      country       TEXT, region TEXT, city TEXT, isp TEXT,
      ip_lat        REAL, ip_lng REAL,          -- approximate position from the IP lookup

      user_agent    TEXT,
      browser       TEXT, os TEXT, device_type TEXT, device_model TEXT,
      screen        TEXT, viewport TEXT, language TEXT, timezone TEXT,
      referrer      TEXT, landing TEXT,
      is_bot        INTEGER NOT NULL DEFAULT 0,

      geo_status    TEXT NOT NULL DEFAULT 'none', -- none | granted | denied | unavailable | timeout
      lat REAL, lng REAL, accuracy REAL, geo_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_visits_visitor ON visits(visitor_id);
    CREATE INDEX IF NOT EXISTS idx_visits_started ON visits(started_at);

    CREATE TABLE IF NOT EXISTS geo_cache (
      key TEXT PRIMARY KEY, data TEXT NOT NULL, fetched_at INTEGER NOT NULL
    );
  `);

  return db;
}

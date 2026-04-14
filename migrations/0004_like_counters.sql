CREATE TABLE IF NOT EXISTS like_counters (
  target_key TEXT NOT NULL PRIMARY KEY,
  total_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

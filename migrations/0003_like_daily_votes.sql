CREATE TABLE IF NOT EXISTS like_daily_votes (
  target_key TEXT NOT NULL,
  client_fingerprint TEXT NOT NULL,
  vote_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (target_key, client_fingerprint, vote_date)
);

CREATE INDEX IF NOT EXISTS idx_like_daily_votes_vote_date ON like_daily_votes(vote_date);

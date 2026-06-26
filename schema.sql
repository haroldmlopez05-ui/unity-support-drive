-- Unity Support Drive — database schema (SQLite)

CREATE TABLE IF NOT EXISTS campaigns (
  id            TEXT PRIMARY KEY,           -- url-friendly slug, e.g. "help-maria-recover"
  title         TEXT NOT NULL,
  story         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'General',
  goal_cents    INTEGER NOT NULL,            -- goal amount in cents (avoid float math for money)
  raised_cents  INTEGER NOT NULL DEFAULT 0,  -- running total, updated by webhook on each paid donation
  donor_count   INTEGER NOT NULL DEFAULT 0,
  organizer_name TEXT NOT NULL,
  organizer_role TEXT,
  location      TEXT,
  photo_url     TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT NOT NULL DEFAULT 'active'   -- active | paused | closed
);

CREATE TABLE IF NOT EXISTS donations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id         TEXT NOT NULL REFERENCES campaigns(id),
  amount_cents        INTEGER NOT NULL,
  donor_name          TEXT NOT NULL DEFAULT 'Anonymous',
  is_anonymous        INTEGER NOT NULL DEFAULT 0,
  message             TEXT,
  stripe_session_id   TEXT UNIQUE,
  stripe_payment_intent TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | failed | refunded
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);

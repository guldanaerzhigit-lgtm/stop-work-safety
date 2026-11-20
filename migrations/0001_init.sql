PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS stop_cases (
  id TEXT PRIMARY KEY,
  location TEXT NOT NULL,
  hazard_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  reporter_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES stop_cases(id),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stop_cases_status ON stop_cases(status);
CREATE INDEX IF NOT EXISTS idx_stop_cases_created ON stop_cases(created_at);
CREATE INDEX IF NOT EXISTS idx_case_events_case ON case_events(case_id);
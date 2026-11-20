PRAGMA foreign_keys = ON;

ALTER TABLE stop_cases ADD COLUMN team_id TEXT REFERENCES teams(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_stop_cases_team ON stop_cases(team_id);
CREATE INDEX IF NOT EXISTS idx_case_events_actor ON case_events(actor_id);

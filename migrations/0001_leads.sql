CREATE TABLE IF NOT EXISTS leads (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 interest TEXT NOT NULL,
 consent_version TEXT NOT NULL,
 created_at TEXT NOT NULL
);


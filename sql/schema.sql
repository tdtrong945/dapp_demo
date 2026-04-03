PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS elections (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  creator_address TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  is_public INTEGER NOT NULL CHECK (is_public IN (0, 1)),
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
  created_at INTEGER NOT NULL,
  closed_at INTEGER,
  tx_hash TEXT
);

CREATE TABLE IF NOT EXISTS election_candidates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_id INTEGER NOT NULL,
  candidate_index INTEGER NOT NULL,
  candidate_name TEXT NOT NULL,
  UNIQUE (election_id, candidate_index),
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS election_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_id INTEGER NOT NULL,
  voter_address TEXT NOT NULL,
  candidate_index INTEGER NOT NULL,
  voted_at INTEGER NOT NULL,
  tx_hash TEXT,
  UNIQUE (election_id, voter_address),
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS election_whitelist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_id INTEGER NOT NULL,
  voter_address TEXT NOT NULL,
  is_authorized INTEGER NOT NULL CHECK (is_authorized IN (0, 1)),
  updated_at INTEGER NOT NULL,
  tx_hash TEXT,
  UNIQUE (election_id, voter_address),
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gym_members (
  member_address TEXT PRIMARY KEY,
  member_name TEXT NOT NULL,
  membership_type INTEGER NOT NULL CHECK (membership_type IN (0, 1)),
  registration_date INTEGER NOT NULL,
  expiry_date INTEGER NOT NULL,
  total_attendance INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS gym_attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_address TEXT NOT NULL,
  attendance_date INTEGER NOT NULL,
  attendance_status INTEGER NOT NULL CHECK (attendance_status IN (0, 1)),
  recorder_address TEXT,
  tx_hash TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (member_address) REFERENCES gym_members(member_address) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gym_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_address TEXT NOT NULL,
  payment_amount_wei TEXT NOT NULL,
  membership_type INTEGER NOT NULL CHECK (membership_type IN (0, 1)),
  payment_kind TEXT NOT NULL CHECK (payment_kind IN ('register', 'renew')),
  paid_at INTEGER NOT NULL,
  tx_hash TEXT,
  FOREIGN KEY (member_address) REFERENCES gym_members(member_address) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_elections_creator ON elections (creator_address);
CREATE INDEX IF NOT EXISTS idx_election_votes_election ON election_votes (election_id);
CREATE INDEX IF NOT EXISTS idx_gym_attendance_member ON gym_attendance (member_address);
CREATE INDEX IF NOT EXISTS idx_gym_payments_member ON gym_payments (member_address);

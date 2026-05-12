-- Create schemas
CREATE SCHEMA IF NOT EXISTS ocs;
CREATE SCHEMA IF NOT EXISTS sync;
CREATE SCHEMA IF NOT EXISTS haztrack;

-- OCS types
CREATE TYPE ocs."OcsRole" AS ENUM ('project_director', 'operations', 'contributor');
CREATE TYPE ocs."PcrStatus" AS ENUM ('active', 'superseded');
CREATE TYPE ocs."FirstAidStatus" AS ENUM ('draft', 'released');

-- HazTrack types
CREATE TYPE haztrack."HazardSource" AS ENUM ('bom', 'afac', 'ses');
CREATE TYPE haztrack."IngestStatus" AS ENUM ('ok', 'partial', 'failed');

-- OCS tables
CREATE TABLE ocs.users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role ocs."OcsRole" NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ocs.pcrs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  category TEXT NOT NULL,
  status ocs."PcrStatus" DEFAULT 'active',
  superseded_by TEXT REFERENCES ocs.pcrs(id),
  created_by TEXT NOT NULL REFERENCES ocs.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE ocs.first_aid_content (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug TEXT UNIQUE NOT NULL,
  body TEXT NOT NULL,
  version INT DEFAULT 1,
  status ocs."FirstAidStatus" DEFAULT 'draft',
  clinical_attestation_pdf_url TEXT,
  released_by TEXT,
  released_at TIMESTAMPTZ
);

CREATE TABLE ocs.audit_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_user_id TEXT NOT NULL REFERENCES ocs.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  at TIMESTAMPTZ DEFAULT now()
);

-- Audit log immutability trigger
CREATE OR REPLACE FUNCTION ocs.audit_log_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only'
    USING ERRCODE = '2F003';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_modify
  BEFORE UPDATE OR DELETE ON ocs.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION ocs.audit_log_immutable();

-- Sync tables
CREATE TABLE sync.mobile_users (
  firebase_uid TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  archetype TEXT,
  preferences JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sync.groups (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  owner_uid TEXT NOT NULL REFERENCES sync.mobile_users(firebase_uid),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE sync.group_members (
  group_id TEXT NOT NULL REFERENCES sync.groups(id),
  user_uid TEXT NOT NULL REFERENCES sync.mobile_users(firebase_uid),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (group_id, user_uid)
);

CREATE TABLE sync.pcr_metadata (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  pcr_id TEXT NOT NULL,
  user_uid TEXT NOT NULL REFERENCES sync.mobile_users(firebase_uid),
  notes TEXT,
  tags TEXT[]
);

-- HazTrack tables
CREATE TABLE haztrack.hazard_cache (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source haztrack."HazardSource" NOT NULL,
  external_id TEXT NOT NULL,
  geom JSONB NOT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL,
  ttl_minutes INT NOT NULL,
  UNIQUE(source, external_id)
);

CREATE TABLE haztrack.ingest_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source haztrack."HazardSource" NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status haztrack."IngestStatus" DEFAULT 'ok',
  items_fetched INT DEFAULT 0,
  error TEXT
);

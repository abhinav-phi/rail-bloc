-- SAFE-001: pgcrypto is REQUIRED for the ledger trigger's digest(). No ledger hash without it.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- DB-003: UUID equality inside GiST EXCLUDE

-- DB-001: INSERT-only ledger role. It is NOLOGIN by design; the application role is
-- granted membership. Real enforcement against the owner/superuser is the guard triggers.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ledger_writer') THEN
    CREATE ROLE ledger_writer NOLOGIN;
  END IF;
END $$;

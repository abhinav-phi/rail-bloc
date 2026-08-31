"""Baseline schema — applies data/sql (single source of truth) when absent

Revision ID: 20260829_initial_schema
Revises: 
Create Date: 2026-08-29 00:00:00.000000
"""

from __future__ import annotations

from pathlib import Path

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260829_initial_schema"
down_revision = None
branch_labels = None
depends_on = None

_SQL_FILES = ("01_init_postgis.sql", "02_schema_ddl.sql", "03_ledger_triggers.sql")


def upgrade() -> None:
    # Fresh docker volumes build the schema via postgres initdb (data/sql is
    # mounted at docker-entrypoint-initdb.d) before this migration runs, and
    # databases that predate Alembic already carry the schema too. The DDL in
    # data/sql is not idempotent, so blindly re-running it here would abort the
    # migrate service on every one of those databases and wedge the whole
    # compose stack behind it. Apply data/sql only when the core objects are
    # missing (i.e. a database provisioned through Alembic alone); otherwise
    # this revision just stamps the start of the migration chain.
    already = op.get_bind().exec_driver_sql(
        "SELECT to_regclass('infrastructure.block_sections') IS NOT NULL"
    ).scalar()
    if already:
        return
    base = Path(__file__).resolve().parents[2] / "data" / "sql"
    for name in _SQL_FILES:
        op.get_bind().exec_driver_sql((base / name).read_text(encoding="utf-8"))


def downgrade() -> None:
    op.get_bind().exec_driver_sql(
        """
        DROP SCHEMA IF EXISTS auth CASCADE;
        DROP SCHEMA IF EXISTS audit CASCADE;
        DROP SCHEMA IF EXISTS optimization CASCADE;
        DROP SCHEMA IF EXISTS operations CASCADE;
        DROP SCHEMA IF EXISTS demands CASCADE;
        DROP SCHEMA IF EXISTS infrastructure CASCADE;
        DROP EXTENSION IF EXISTS "btree_gist";
        DROP EXTENSION IF EXISTS "postgis";
        DROP EXTENSION IF EXISTS "pgcrypto";
        """
    )

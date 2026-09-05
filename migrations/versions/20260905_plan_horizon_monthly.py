"""plan horizon MONTHLY

PS 027 (SIH26027) asks for block plans over multiple time horizons: Weekly, Monthly.
MONTHLY was absent from every horizon CHECK constraint. This revision extends both
optimization.solver_runs.horizon and optimization.block_plans.plan_horizon, matching
the data/sql/02_schema_ddl.sql fresh-install parity change. Each table's CHECK is
rebuilt against its own column.

Revision ID: 20260905_plan_horizon_monthly
Revises: 20260830_auth_users_salt
"""
from alembic import op

revision = "20260905_plan_horizon_monthly"
down_revision = "20260830_auth_users_salt"
branch_labels = None
depends_on = None

# (table, auto-named CHECK constraint, owning column)
_TABLES = (
    ("optimization.solver_runs", "solver_runs_horizon_check", "horizon"),
    ("optimization.block_plans", "block_plans_plan_horizon_check", "plan_horizon"),
)
_OLD = "('STRATEGIC_26W','WEEKLY','REALTIME')"
_NEW = "('STRATEGIC_26W','MONTHLY','WEEKLY','REALTIME')"


def upgrade() -> None:
    for table, cname, col in _TABLES:
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {cname}")
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT {cname} CHECK ({col} IN {_NEW})"
        )


def downgrade() -> None:
    for table, cname, col in _TABLES:
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {cname}")
        op.execute(
            f"ALTER TABLE {table} ADD CONSTRAINT {cname} CHECK ({col} IN {_OLD})"
        )

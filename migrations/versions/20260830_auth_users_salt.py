"""auth users salt

Revision ID: 20260830_auth_users_salt
Revises: 20260829_initial_schema
Create Date: 2026-08-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260830_auth_users_salt'
down_revision: Union[str, None] = '20260829_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add salt column with IF NOT EXISTS (some existing databases might have it from earlier apply, others won't)
    op.execute(sa.text("ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS salt VARCHAR(64);"))
    # Backfill existing rows with legacy fixed salt so their hashes still verify
    op.execute(sa.text("UPDATE auth.users SET salt = 'railbloc-salt' WHERE salt IS NULL;"))
    # Now set it NOT NULL
    op.execute(sa.text("ALTER TABLE auth.users ALTER COLUMN salt SET NOT NULL;"))

def downgrade() -> None:
    op.execute(sa.text("ALTER TABLE auth.users DROP COLUMN IF EXISTS salt;"))

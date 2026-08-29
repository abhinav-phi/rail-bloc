from pathlib import Path


def test_alembic_migration_files_exist():
    root = Path(__file__).resolve().parents[2]
    alembic_ini = root / "migrations" / "alembic.ini"
    versions_dir = root / "migrations" / "versions"

    assert alembic_ini.exists(), "Alembic config should exist"
    assert versions_dir.exists(), "Migration versions directory should exist"

    contents = alembic_ini.read_text()
    assert "script_location = migrations" in contents

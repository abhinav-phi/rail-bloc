from pathlib import Path


def test_ruff_and_frontend_format_config_exist():
    root = Path(__file__).resolve().parents[2]
    pyproject = root / "pyproject.toml"
    package_json = root / "apps" / "web" / "package.json"
    prettier = root / "apps" / "web" / ".prettierrc"

    pyproject_text = pyproject.read_text()
    assert "[tool.ruff]" in pyproject_text
    assert 'target-version = "py311"' in pyproject_text

    package_text = package_json.read_text()
    assert '"format": "prettier --write .' in package_text
    assert '"format:check": "prettier --check .' in package_text

    assert prettier.exists(), ".prettierrc should exist"

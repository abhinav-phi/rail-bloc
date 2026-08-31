"""Automated smoke test for the complete Docker Compose stack."""
from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
TIMEOUT_SECONDS = 180
EXPECTED_SEED_LOG = "Seeded: 12 sections, 286 demands, 276 paths."


def compose(*arguments: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["docker", "compose", *arguments],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )

    if check and result.returncode != 0:
        print(result.stdout)
        print(result.stderr, file=sys.stderr)
        raise RuntimeError(f"docker compose {' '.join(arguments)} failed")

    return result


def endpoint_ready(url: str, json_health: bool = False) -> bool:
    try:
        request = Request(url, method="GET")
        with urlopen(request, timeout=5) as response:
            if response.status != 200:
                return False

            if json_health:
                payload = json.loads(response.read())
                return payload.get("status") == "ok"

            return True
    except Exception:
        return False


def compose_rows() -> list[dict]:
    output = compose("ps", "-a", "--format", "json").stdout.strip()
    if not output:
        return []

    try:
        parsed = json.loads(output)
        return parsed if isinstance(parsed, list) else [parsed]
    except json.JSONDecodeError:
        return [json.loads(line) for line in output.splitlines() if line.strip()]


def services_ready(expected_services: set[str]) -> bool:
    rows = {row["Service"]: row for row in compose_rows()}

    if not expected_services.issubset(rows):
        return False

    for service in expected_services:
        row = rows[service]
        state = str(row.get("State", "")).lower()
        health = str(row.get("Health", "")).lower()
        status = str(row.get("Status", "")).lower()

        if service in {"seeder", "migrate"}:
            exit_code = str(row.get("ExitCode", ""))
            if state != "exited":
                return False
            if exit_code != "0" and "exited (0)" not in status:
                return False
        else:
            if state != "running":
                return False
            if health and health != "healthy":
                return False

    return True


def main() -> None:
    if not (ROOT / ".env").exists():
        raise RuntimeError("Missing .env file; copy .env.example to .env first")

    print("Starting Docker Compose stack...")
    compose("up", "-d")

    expected_services = set(
        compose("config", "--services").stdout.splitlines()
    )

    deadline = time.monotonic() + TIMEOUT_SECONDS

    while time.monotonic() < deadline:
        compose_ok = services_ready(expected_services)
        api_ok = endpoint_ready(
            "http://localhost:8000/health",
            json_health=True,
        )
        web_ok = endpoint_ready("http://localhost:5173")

        if compose_ok and api_ok and web_ok:
            break

        time.sleep(5)
    else:
        print(compose("ps", "-a").stdout)
        raise RuntimeError("Stack did not become ready before timeout")

    seeder_logs = compose("logs", "--no-color", "seeder").stdout
    if EXPECTED_SEED_LOG not in seeder_logs:
        raise RuntimeError(
            f"Expected seeder evidence not found: {EXPECTED_SEED_LOG}"
        )

    print("PASS: Docker Compose services are ready")
    print("PASS: API /health returned status=ok")
    print("PASS: Web frontend returned HTTP 200")
    print(f"PASS: {EXPECTED_SEED_LOG}")


if __name__ == "__main__":
    main()
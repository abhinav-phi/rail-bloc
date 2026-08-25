from __future__ import annotations
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    api_port: int = 8000
    api_host: str = "0.0.0.0"
    database_url: str = "postgresql+asyncpg://rail_admin:rail_secure_password@postgres:5432/railbloc_db"
    redis_url: str = "redis://redis:6379/0"
    jwt_secret: str = "super_secret_jwt_key_railbloc_2026"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480
    seed_password: str = "railbloc"

    solver_max_time_seconds: float = 35.0
    solver_num_workers: int = 8
    objective_weight_pax_delay: float = 10.0
    objective_weight_frt_delay: float = 4.0
    objective_weight_shadow_reward: float = 25.0
    objective_weight_machine_idle: float = 2.5
    objective_weight_unaddressed_defect: float = 100.0
    objective_weight_early_start: float = 0.05

    imd_api_key: str = "mock_imd_weather_key_railway_ops"
    coa_bridge_secret: str = "mock_coa_dispatch_token"
    ingest_key_tms: str = "mock_tms_source_key"
    ingest_key_tdms: str = "mock_tdms_source_key"
    ingest_key_smms: str = "mock_smms_source_key"
    ingest_key_fois: str = "mock_fois_freight_token"

    demand_staleness_ttl_hours: float = 12.0
    weather_staleness_ttl_hours: float = 3.0
    freight_hard_confidence: float = 0.60
    headway_high_priority_mins: int = 15
    headway_default_mins: int = 5
    emergency_solve_budget_seconds: float = 35.0
    max_sentinel_retries: int = 3
    weekly_plan_cron: str = "0 15 * * 4"
    enable_ml_urgency: bool = True
    bundling_gap_mins: int = 0
    coa_ack_delay_seconds: float = 1.5

    class Config:
        env_file = ".env"
        extra = "ignore"

    def ingest_keys(self) -> dict[str, str]:
        return {"TMS": self.ingest_key_tms, "TDMS": self.ingest_key_tdms,
                "SMMS": self.ingest_key_smms, "FOIS": self.ingest_key_fois}


settings = Settings()

from __future__ import annotations
import random
from datetime import datetime, timedelta


def gen_timetable(sections, day_start: datetime, seed: int = 52):
    from .corridor_gen import PAX_TRAINS
    rng = random.Random(seed)
    paths = []
    for number, ttype, rank, speed_kmph in PAX_TRAINS:
        t = day_start + timedelta(hours=rng.uniform(0, 12))
        for sec in sections:
            length_km = sec["end_km"] - sec["start_km"]
            minutes = length_km / speed_kmph * 60 + rng.uniform(0, 3)
            entry, exit_ = t, t + timedelta(minutes=minutes)
            paths.append(dict(train_number=number, train_type=ttype, section_code=sec["section_code"],
                              priority_rank=rank, scheduled_entry=entry, scheduled_exit=exit_,
                              source="WTT",
                              metadata={"commercial_stops": []}))
            t = exit_ + timedelta(minutes=rng.uniform(1, 4))
    return paths


def gen_freight(sections, day_start: datetime, seed: int = 43):
    from .corridor_gen import FREIGHT_TRAINS
    rng = random.Random(seed)
    paths = []
    for i in range(8):
        tpl, rake, commodity, rank = FREIGHT_TRAINS[i % len(FREIGHT_TRAINS)]
        number = tpl.format(i=i + 1)
        t = day_start + timedelta(hours=rng.uniform(0, 20))
        for sec in sections:
            length_km = sec["end_km"] - sec["start_km"]
            minutes = length_km / 50 * 60
            entry, exit_ = t, t + timedelta(minutes=minutes)
            paths.append(dict(train_number=number, train_type="FREIGHT", section_code=sec["section_code"],
                              priority_rank=rank, scheduled_entry=entry, scheduled_exit=exit_,
                              source="FOIS_FORECAST",
                              metadata={"commodity_code": commodity, "rake_type": rake,
                                        "origin_station": sections[0]["section_code"].split("-")[0],
                                        "dest_station": sections[-1]["section_code"].split("-")[2],
                                        "stabling_siding_id": f"SIDING-{rng.randint(1, 6):02d}",
                                        "forecast_confidence": round(rng.uniform(0.30, 0.95), 2)}))
            t = exit_
    return paths


def gen_weather(day_start: datetime, seed: int = 44):
    rng = random.Random(seed)
    alerts = []
    for i in range(3):
        lat, lon = 27.5 + rng.uniform(-0.6, 0.6), 78.5 + rng.uniform(-0.5, 0.8)
        d = 0.35
        alerts.append(dict(
            alert_type=rng.choice(["THUNDERSTORM_LIGHTNING", "TORRENTIAL_RAIN", "EXCESSIVE_HEAT_EXPANSION"]),
            severity=rng.choice(["YELLOW_WATCH", "ORANGE_BE_PREPARED", "RED_ACTION_REQUIRED"]),
            polygon=[[lon - d, lat - d], [lon + d, lat - d], [lon + d, lat + d], [lon - d, lat + d], [lon - d, lat - d]],
            precipitation_mm_hr=round(rng.uniform(5, 90), 1),
            rail_temperature_celsius=round(rng.uniform(45, 70), 1),
            prohibited_work_types=["OHE_CANTILEVER_ADJ", "TTR_RAIL_RENEWAL", "BCM_DEEP_SCREENING"],
            valid_until=day_start + timedelta(hours=rng.uniform(6, 24))))
    return alerts

from __future__ import annotations

import random
from datetime import datetime, timedelta


def gen_demands(sections, week_start: datetime, seed: int = 42, n_eng: int = 70,
                n_trd: int = 45, n_snt: int = 45, strategic: bool = False):
    from .corridor_gen import ENG_ACTIVITIES, MACHINES, SNT_ACTIVITIES, TRD_ACTIVITIES
    rng = random.Random(seed)
    out = []
    horizon_days = 182 if strategic else 7

    def window(min_lead_h=2):
        es = week_start + timedelta(hours=rng.uniform(min_lead_h, horizon_days * 24 - 24))
        ld = es + timedelta(hours=rng.uniform(24, horizon_days * 24))
        return es, min(ld, week_start + timedelta(days=horizon_days))

    for i in range(n_eng):
        sec = rng.choice(sections)
        tgi = rng.uniform(30, 90)
        gmt = rng.uniform(10, 60)
        imr = rng.choice(["P1_URGENT", "P2_MONITOR", "ROUTINE"])
        wear = rng.uniform(0, 12)
        imr_num = {"P1_URGENT": 3, "P2_MONITOR": 2, "ROUTINE": 0}[imr]
        u = min(1.0, max(0.0, 0.10 + 0.55 * (90 - tgi) / 60 + 0.15 * gmt / 60
                         + 0.15 * imr_num / 3 + 0.05 * wear / 12))
        es, ld = window()
        machinery = rng.sample([m[0] for m in MACHINES if m[1] in ("TAMPING", "DEEP_SCREENING", "UNIVERSAL_TAMPING")],
                               rng.randint(1, 2)) if rng.random() < 0.8 else []
        out.append(dict(external_source="TMS", external_ref_id=f"TMS-DEF-2026-{i + 890:04d}",
                        department="ENGINEERING", section_code=sec["section_code"],
                        activity_code=rng.choice(ENG_ACTIVITIES),
                        min_duration_mins=rng.randint(120, 240),
                        earliest_start=es, latest_deadline=ld, urgency_score=round(u, 3),
                        machinery_req=machinery,
                        features={"tgi_index": round(tgi, 1), "cumulative_gmt": round(gmt, 1),
                                  "imr_severity": imr, "rail_wear_loss_percent": round(wear, 2)}))

    for i in range(n_trd):
        sec = rng.choice(sections)
        wire = rng.uniform(8.0, 12.4)
        spark = rng.randint(1, 5)
        u = min(1.0, max(0.0, 0.15 + (12.24 - wire) / 4.0 + spark / 10.0))
        es, ld = window()
        out.append(dict(external_source="TDMS", external_ref_id=f"TDMS-OHE-2026-{i + 4400:04d}",
                        department="TRD", section_code=sec["section_code"],
                        activity_code=rng.choice(TRD_ACTIVITIES),
                        min_duration_mins=rng.randint(60, 180),
                        earliest_start=es, latest_deadline=ld, urgency_score=round(u, 3),
                        machinery_req=["OHE_TOWER_04"] if rng.random() < 0.4 else [],
                        features={"contact_wire_diameter_mm": round(wire, 2),
                                  "carbon_brush_sparking_index": spark,
                                  "elementary_section_id": None, "substation_id": None}))

    for i in range(n_snt):
        sec = rng.choice(sections)
        amps = rng.uniform(2.5, 5.2)
        relay = rng.uniform(60, 140)
        u = min(1.0, max(0.0, 0.1 + max(0, (amps - 3.5)) / 1.5 + max(0, (relay - 90)) / 60))
        es, ld = window()
        out.append(dict(external_source="SMMS", external_ref_id=f"SMMS-SIG-2026-{i + 7700:04d}",
                        department="SIGNAL_TELECOM", section_code=sec["section_code"],
                        activity_code=rng.choice(SNT_ACTIVITIES),
                        min_duration_mins=rng.randint(45, 120),
                        earliest_start=es, latest_deadline=ld, urgency_score=round(u, 3),
                        machinery_req=[],
                        features={"interlocking_gear_id": f"PM-{rng.randint(100, 999)}B",
                                  "point_operating_current_amps": round(amps, 2),
                                  "relay_pick_up_time_ms": round(relay, 1),
                                  "disconnection_notice_type": rng.choice(["NON_INTERLOCKED", "RESTRICTED_DISCONNECTION"])}))
    return out

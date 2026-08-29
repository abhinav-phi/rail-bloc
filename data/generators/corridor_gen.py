"""Pure synthetic-corridor generator — the single source of truth used by BOTH the
seed scripts and the benchmark harness, so B0/B1/RAIL-BLOC see identical data by
construction (BENCH-001). Documented correlation structure (ML-001): defects cluster
spatially; urgency correlates with TGI/GMT/IMR/wear per domain rules."""
from __future__ import annotations

import random

STATIONS = [
    ("NDLS", 0.0, 77.2215, 28.6425), ("GZB", 24.5, 77.4310, 28.6690),
    ("ALJN", 68.2, 78.0780, 27.8970), ("TDL", 118.0, 78.4710, 27.6010),
    ("ETW", 205.0, 79.0210, 26.7770), ("CNB", 250.0, 80.3540, 26.4490),
]
SECTIONS = [
    ("NDLS-GZB-UP", "DLI", "NR", "DOUBLE", 160), ("NDLS-GZB-DN", "DLI", "NR", "DOUBLE", 160),
    ("GZB-ALJN-UP", "DLI", "NR", "DOUBLE", 140), ("GZB-ALJN-DN", "DLI", "NR", "DOUBLE", 140),
    ("GZB-ALJN-3L", "DLI", "NR", "3RD_LINE", 120),
    ("ALJN-TDL-UP", "DLI", "NCR", "DOUBLE", 130), ("ALJN-TDL-DN", "DLI", "NCR", "DOUBLE", 130),
    ("TDL-ETW-UP", "PRYJ", "NCR", "DOUBLE", 120), ("TDL-ETW-DN", "PRYJ", "NCR", "DOUBLE", 120),
    ("TDL-ETW-3L", "PRYJ", "NCR", "3RD_LINE", 110),
    ("ETW-CNB-UP", "PRYJ", "NCR", "DOUBLE", 130), ("ETW-CNB-DN", "PRYJ", "NCR", "DOUBLE", 130),
]
MACHINES = [
    ("DTT_TAMP_01", "TAMPING", 10.0, 40), ("DTT_TAMP_02", "TAMPING", 70.0, 40),
    ("BCM_SCREEN_03", "DEEP_SCREENING", 120.0, 30), ("OHE_TOWER_04", "OHE_TOWER", 65.0, 50),
    ("TAMP_UNI_05", "UNIVERSAL_TAMPING", 210.0, 45),
]
FEEDING_GROUPS = [["NDLS-GZB-UP", "NDLS-GZB-DN"], ["GZB-ALJN-UP", "GZB-ALJN-DN", "GZB-ALJN-3L"],
                  ["ALJN-TDL-UP", "ALJN-TDL-DN"], ["TDL-ETW-UP", "TDL-ETW-DN", "TDL-ETW-3L"],
                  ["ETW-CNB-UP", "ETW-CNB-DN"]]

ENG_ACTIVITIES = ["BCM_DEEP_SCREENING", "DTT_TAMPING", "TTR_RAIL_RENEWAL", "POINTS_PACKING"]
TRD_ACTIVITIES = ["OHE_CANTILEVER_ADJ", "CONTACT_WIRE_RENEWAL", "INSULATOR_WASHING", "TSS_TRANSFORMER_MAINT"]
SNT_ACTIVITIES = ["POINT_MACHINE_OVERHAUL", "TRACK_CIRCUIT_TUNING", "AXLE_COUNTER_RESET", "EI_CARD_TESTING"]
PAX_TRAINS = [
    ("22436", "VANDE_RAJDHANI", 1, 130), ("22435", "VANDE_RAJDHANI", 1, 130),
    ("12952", "VANDE_RAJDHANI", 2, 110), ("12310", "VANDE_RAJDHANI", 2, 105),
    ("12418", "MAIL_EXP", 3, 90), ("12554", "MAIL_EXP", 3, 88), ("12802", "MAIL_EXP", 3, 92),
    ("12404", "MAIL_EXP", 3, 95), ("12616", "MAIL_EXP", 4, 80), ("12406", "MAIL_EXP", 4, 78),
    ("04412", "PASSENGER", 6, 55), ("04414", "PASSENGER", 6, 55), ("04416", "PASSENGER", 6, 58),
    ("64584", "PASSENGER", 6, 50), ("64586", "PASSENGER", 6, 50),
]
FREIGHT_TRAINS = [
    ("BOXN_COAL_{i}", "BOXN", "COAL", 8), ("BCN_CEMENT_{i}", "BCNHL", "CEMENT", 8),
    ("BTPN_POL_{i}", "BTPN", "POL", 9), ("BOXNHL_ORE_{i}", "BOXNHL", "IRON_ORE", 7),
    ("BOXN_BOX_{i}", "BOXN", "CONTAINER", 7),
]
WEATHER_SENSITIVE = ["OHE_CANTILEVER_ADJ", "TTR_RAIL_RENEWAL", "BCM_DEEP_SCREENING", "DTT_TAMPING"]


def _linestring(a: tuple, b: tuple, n: int = 12) -> list[list[float]]:
    return [[a[2] + (b[2] - a[2]) * i / n + (0.004 if i % 3 == 0 else 0),
             a[3] + (b[3] - a[3]) * i / n - (0.003 if i % 4 == 0 else 0)] for i in range(n + 1)]


def corridor(seed: int = 42):
    rng = random.Random(seed)
    stations = {name: km for name, km, _, _ in STATIONS}
    sections = []
    for code, division, zone, line_type, speed in SECTIONS:
        a_name, b_name = code.split("-")[0], code.split("-")[1]
        a = next(s for s in STATIONS if s[0] == a_name)
        b = next(s for s in STATIONS if s[0] == b_name)
        crossovers = [f"PM-{a_name}-{i}" for i in range(1, rng.randint(2, 5))]
        sections.append(dict(section_code=code, division=division, zone=zone,
                             start_km=a[1], end_km=b[1], line_type=line_type,
                             speed_limit_mps=speed, crossover_points=crossovers,
                             coordinates=_linestring(a, b)))
    feeding = []
    for gi, group in enumerate(FEEDING_GROUPS):
        feeding.append(dict(feeding_section_code=f"ES-{gi + 1:03d}",
                            substation_ref=f"TSS-{group[0].split('-')[1]}",
                            section_codes=group,
                            coordinates=_linestring(STATIONS[min(gi * 2, 4)], STATIONS[min(gi * 2 + 1, 5)], 8)))
    return sections, feeding, stations

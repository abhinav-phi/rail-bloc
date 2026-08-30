"""The 10 enumerated checks (TechSpec §2.3 / Design.md §3 / Tracker correction of the
fabricated '14/14'). Exactly these ten exist; the Action Preview Card renders exactly
these ten. Adding a check means updating this enum, the validator, and the card —
never a bare count."""
from enum import StrEnum


class CheckID(StrEnum):
    GSR1_ABSOLUTE_BLOCK_EXCLUSION = "G&SR-1 Absolute Block Exclusion"
    GSR2_INTERLOCKING_PRECEDENCE = "G&SR-2 Interlocking Precedence Acknowledgment"
    GSR3_FAIL_CLOSED_CONSISTENCY = "G&SR-3 Fail-Closed State Consistency"
    GSR4_POWER_ISOLATION_BOUNDARY = "G&SR-4 Power Isolation Boundary Containment"
    GSR5_HEADWAY_MARGIN = "G&SR-5 Headway Margin"
    MILP_C1_SECTION_EXCLUSION = "MILP-C1 Section Exclusion"
    MILP_C2_MAINTENANCE_ENCLOSURE = "MILP-C2 Maintenance Enclosure"
    MILP_C3_SHADOW_CONTAINMENT = "MILP-C3 Shadow Bundling Window Containment"
    MILP_C4_NON_FRAGMENTED_DURATION = "MILP-C4 Non-Fragmented Duration"
    MILP_C5_MACHINE_CONSERVATION = "MILP-C5 Machine Spatial Conservation"


STRUCTURAL_SUBSET = {  # TechSpec §2.3: re-run synchronously at T-2h and inside NFR-002
    CheckID.GSR1_ABSOLUTE_BLOCK_EXCLUSION,
    CheckID.GSR5_HEADWAY_MARGIN,
    CheckID.MILP_C1_SECTION_EXCLUSION,
    CheckID.MILP_C4_NON_FRAGMENTED_DURATION,
}

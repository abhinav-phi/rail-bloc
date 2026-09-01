"""Property tests for the 10-enumerated-check Sentinel module (TASK-047 DoD)."""
from dataclasses import replace as _rep
from datetime import UTC, datetime, timedelta

from packages.core.models import DemandInput, MachineInfo, PlanCandidate, ScheduledWork
from packages.sentinel.rules import CheckID
from packages.sentinel.validator import (
    AckRecord,
    FeedingMapEntry,
    SentinelContext,
    TrainInterval,
    build_ack_lookup,
    build_machine_assignments,
    validate_plan,
    validate_set,
    validate_structural_subset,
)

T0 = datetime(2026, 1, 6, 1, 0, tzinfo=UTC)


def demand(did="d1", dept="ENGINEERING", dur=120, sec="S1", urgency=0.5):
    return DemandInput(id=did, section_id=sec, section_code="SC", division="DLI",
                       section_start_km=0.0, section_end_km=10.0, department=dept,
                       activity_code="DTT_TAMPING", min_duration_mins=dur,
                       earliest_start=T0, latest_deadline=T0 + timedelta(days=2),
                       urgency_score=urgency, machinery=[],
                       source_ingested_at=datetime.now(UTC) - timedelta(minutes=30))


def plan(works, start=T0, end=None, sec="S1"):
    return PlanCandidate(section_id=sec, section_code="SC", division="DLI",
                         start_time=start, end_time=end or start + timedelta(hours=3),
                         primary_demand_id=works[0].demand.id, works=works,
                         is_shadow_block=len({w.demand.department for w in works}) >= 2,
                         plan_horizon="WEEKLY")


def work(d, start=None):
    return ScheduledWork(d, start or T0 + timedelta(hours=1),
                         (start or T0 + timedelta(hours=1)) + timedelta(minutes=d.min_duration_mins))


def ctx(trains=None, feeding_map=None, acks=None, machine_infos=None,
        machine_assignments=None, committed_windows=None):
    return SentinelContext(
        train_intervals=trains or [],
        feeding_map=feeding_map or [FeedingMapEntry("F1", frozenset({"S1"}))],
        acks=acks or {},
        machine_infos=machine_infos or [],
        machine_assignments=machine_assignments or {},
        committed_windows=committed_windows or {},
        now=datetime.now(UTC))


def test_exactly_ten_enumerated_checks():
    v = validate_plan(plan([work(demand())]), ctx())
    assert len(v.results) == 10
    assert {r.check_id for r in v.results} == set(CheckID)
    assert v.passed


def test_gsr1_conflicting_train_fails():
    trains = [TrainInterval("S1", 4, T0 + timedelta(hours=1, minutes=30), T0 + timedelta(hours=2))]
    v = validate_plan(plan([work(demand())]), ctx(trains=trains))
    g = next(r for r in v.results if r.check_id == CheckID.GSR1_ABSOLUTE_BLOCK_EXCLUSION)
    assert not g.passed


def test_ack_lookup_uses_content_hash_key_and_record_id():
    ch = "a" * 64
    rows = [(ch, datetime.now(UTC), datetime.now(UTC))]
    acks = build_ack_lookup(rows)
    assert set(acks) == {ch}
    assert acks[ch].plan_id == ch
    assert acks[ch].sm_acked is True
    assert acks[ch].controller_acked is True


def test_gsr2_pending_until_both_acks_then_pass():
    d = demand(dept="SIGNAL_TELECOM")
    p = plan([work(d)])
    ch = validate_plan(p, ctx()).content_hash
    no_ack = validate_plan(p, ctx())
    g = next(r for r in no_ack.results if r.check_id == CheckID.GSR2_INTERLOCKING_PRECEDENCE)
    assert not g.passed and g.pending
    assert not no_ack.passed and no_ack.only_gsr2_outstanding()
    half = validate_plan(p, ctx(acks={ch: AckRecord(ch, True, False)}))
    assert not half.passed
    both = validate_plan(p, ctx(acks={ch: AckRecord(ch, True, True)}))
    assert both.passed


def test_gsr3_stale_telemetry_fails():
    stale_d = _rep(demand(), source_ingested_at=datetime.now(UTC) - timedelta(days=2))
    v = validate_plan(plan([ScheduledWork(stale_d, T0, T0 + timedelta(hours=2))]), ctx())
    g = next(r for r in v.results if r.check_id == CheckID.GSR3_FAIL_CLOSED_CONSISTENCY)
    assert not g.passed


def test_gsr4_trd_plan_spilling_feeding_boundary_fails():
    d = demand(dept="TRD")
    p = plan([work(d)])
    spilling = [FeedingMapEntry("F9", frozenset({"S1", "S2"}))]
    # Spill with an ACTIVE neighbour (train crossing the window) -> FAIL.
    trains = [TrainInterval("S2", 5, T0 + timedelta(hours=1), T0 + timedelta(hours=2))]
    v = validate_plan(p, ctx(feeding_map=spilling, trains=trains))
    g = next(r for r in v.results if r.check_id == CheckID.GSR4_POWER_ISOLATION_BOUNDARY)
    assert not g.passed  # R6.5: back-feed source present in spilled member
    # Spill with a COMMITTED plan on the neighbour -> FAIL as well.
    v2 = validate_plan(p, ctx(feeding_map=spilling,
                              committed_windows={"S2": [(p.start_time, p.end_time)]}))
    g2 = next(r for r in v2.results if r.check_id == CheckID.GSR4_POWER_ISOLATION_BOUNDARY)
    assert not g2.passed
    # Spill with a completely idle neighbour -> safe partial isolation, PASS.
    v3 = validate_plan(p, ctx(feeding_map=spilling))
    g3 = next(r for r in v3.results if r.check_id == CheckID.GSR4_POWER_ISOLATION_BOUNDARY)
    assert g3.passed and "idle" in g3.detail
    # Full containment still passes trivially.
    contained = [FeedingMapEntry("F1", frozenset({"S1"}))]
    v4 = validate_plan(p, ctx(feeding_map=contained))
    assert next(r for r in v4.results if r.check_id == CheckID.GSR4_POWER_ISOLATION_BOUNDARY).passed


def test_gsr5_headway_margin():
    # High-priority train arrives 20 min after block end → pass at 15-min margin.
    trains = [TrainInterval("S1", 1, T0 + timedelta(hours=3, minutes=20), T0 + timedelta(hours=3, minutes=50))]
    ok = validate_plan(plan([work(demand())]), ctx(trains=trains))
    assert next(r for r in ok.results if r.check_id == CheckID.GSR5_HEADWAY_MARGIN).passed
    # Train inside the margin window → fail.
    close = [TrainInterval("S1", 1, T0 + timedelta(hours=3, minutes=5), T0 + timedelta(hours=3, minutes=35))]
    bad = validate_plan(plan([work(demand())]), ctx(trains=close))
    assert not next(r for r in bad.results if r.check_id == CheckID.GSR5_HEADWAY_MARGIN).passed


def test_milp_c2_c3_c4_enclosure_and_fragmentation():
    d = demand(dur=60)
    escaping = ScheduledWork(d, T0 - timedelta(hours=1), T0)
    v = validate_plan(plan([escaping]), ctx())
    c2 = next(r for r in v.results if r.check_id == CheckID.MILP_C2_MAINTENANCE_ENCLOSURE)
    c3 = next(r for r in v.results if r.check_id == CheckID.MILP_C3_SHADOW_CONTAINMENT)
    assert not c2.passed and c3.passed
    short = ScheduledWork(demand(dur=120), T0 + timedelta(hours=1), T0 + timedelta(hours=1, minutes=30))
    v2 = validate_plan(plan([short]), ctx())
    c4 = next(r for r in v2.results if r.check_id == CheckID.MILP_C4_NON_FRAGMENTED_DURATION)
    assert not c4.passed


def test_milp_c3_shadow_bundle_must_fit_primary_window():
    primary = ScheduledWork(demand("p", dur=30), T0, T0 + timedelta(minutes=30))
    shadow = ScheduledWork(demand("s", dept="TRD", dur=30), T0 + timedelta(minutes=20), T0 + timedelta(minutes=50))
    p = PlanCandidate(
        section_id="S1",
        section_code="SC",
        division="DLI",
        start_time=T0,
        end_time=T0 + timedelta(minutes=60),
        primary_demand_id="p",
        works=[primary, shadow],
        is_shadow_block=True,
        plan_horizon="WEEKLY",
    )
    v = validate_plan(p, ctx())
    c2 = next(r for r in v.results if r.check_id == CheckID.MILP_C2_MAINTENANCE_ENCLOSURE)
    c3 = next(r for r in v.results if r.check_id == CheckID.MILP_C3_SHADOW_CONTAINMENT)
    assert c2.passed
    assert not c3.passed


def test_milp_c1_set_level_overlap_detected():
    a = plan([work(demand("a"))])
    b = plan([work(demand("b"))], start=T0 + timedelta(hours=1))
    verdicts = validate_set([a, b], ctx())
    assert all(not next(r for r in v.results if r.check_id == CheckID.MILP_C1_SECTION_EXCLUSION).passed
               for v in verdicts)


def test_build_machine_assignments_from_candidates():
    d1 = _rep(demand("m1", sec="S1"), machinery=["M1"], section_start_km=0.0, section_end_km=10.0)
    d2 = _rep(demand("m2", sec="S2"), machinery=["M1"], section_start_km=100.0, section_end_km=110.0)
    a = plan([ScheduledWork(d1, T0, T0 + timedelta(hours=2))], sec="S1")
    b = plan([ScheduledWork(d2, T0 + timedelta(hours=2, minutes=1), T0 + timedelta(hours=4))], sec="S2")
    assert build_machine_assignments([a, b]) == {
        "M1": [(T0, T0 + timedelta(hours=2), 5.0),
               (T0 + timedelta(hours=2, minutes=1), T0 + timedelta(hours=4), 105.0)]
    }


def test_milp_c5_machine_travel_infeasible_detected():
    m = MachineInfo("M1", "TAMPING", 0.0, 40)
    dm1 = _rep(demand("m1"), machinery=["M1"])
    dm2 = _rep(demand("m2"), machinery=["M1"])
    pa = plan([ScheduledWork(dm1, T0, T0 + timedelta(hours=2))])
    pb = plan([ScheduledWork(dm2, T0 + timedelta(hours=2, minutes=1), T0 + timedelta(hours=4))], sec="S2")
    c = ctx(machine_infos=[m],
            machine_assignments={"M1": [(T0, T0 + timedelta(hours=2), 5.0),
                                        (T0 + timedelta(hours=2, minutes=1), T0 + timedelta(hours=4), 100.0)]})
    verdicts = validate_set([pa, pb], c)
    flagged = [r for v in verdicts for r in v.results
               if r.check_id == CheckID.MILP_C5_MACHINE_CONSERVATION and not r.passed]
    assert flagged


def test_structural_subset_is_checks_1_5_6_9():
    sub = validate_structural_subset(plan([work(demand())]), ctx())
    ids = {r.check_id for r in sub.results}
    assert ids == {CheckID.GSR1_ABSOLUTE_BLOCK_EXCLUSION, CheckID.GSR5_HEADWAY_MARGIN,
                   CheckID.MILP_C1_SECTION_EXCLUSION, CheckID.MILP_C4_NON_FRAGMENTED_DURATION}

import Link from 'next/link';
import {
  ArrowRight,
  Shield,
  BrainCircuit,
  ScrollText,
  Layers3,
  Clock,
  Train,
  Zap,
  Lock,
  Activity,
  ChevronRight,
  ShieldCheck,
  GitMerge,
  Gauge,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-[#020817] text-white overflow-hidden selection:bg-cyan-500/30">
      {/* ============ AMBIENT BACKGROUND GRID ============ */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.4) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ============ NAVIGATION ============ */}
      <nav className="relative z-50 flex items-center justify-between px-6 md:px-12 lg:px-20 py-5">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center">
              <Train className="h-5 w-5 text-[#020817]" strokeWidth={2.5} />
            </div>
            <div className="absolute -inset-1 rounded-lg bg-gradient-to-br from-cyan-400/20 to-emerald-400/20 blur-sm -z-10" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            RAIL-BLOC
          </span>
          <span className="hidden sm:inline-block text-[10px] font-mono tracking-widest uppercase text-cyan-400/70 bg-cyan-400/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
            SIH26027
          </span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#architecture" className="hover:text-white transition-colors">Architecture</a>
          <a href="#safety" className="hover:text-white transition-colors">Safety</a>
        </div>

        <Link
          href="/login"
          className="group flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
        >
          Enter System
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </nav>

      {/* ============ HERO SECTION ============ */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-32 md:pt-32 md:pb-40 max-w-6xl mx-auto">

        {/* Glowing mesh background */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* Primary cyan glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/15 rounded-full blur-[120px] animate-pulse-glow" />
          {/* Emerald accent glow */}
          <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
          {/* Warm accent glow */}
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-amber-500/8 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '3s' }} />
        </div>

        {/* Ministry badge */}
        <div className="animate-fade-in flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-slate-400 mb-8 px-4 py-2 rounded-full border border-white/5 bg-white/[0.02]">
          <Shield className="h-3.5 w-3.5 text-cyan-400" />
          Ministry of Railways · Government of India
        </div>

        {/* Hero headline — architectural scale */}
        <h1 className="animate-slide-up">
          <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9]">
            <span className="bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent">
              Automated.
            </span>
          </span>
          <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] mt-2">
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              Optimized.
            </span>
          </span>
          <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[0.9] mt-2">
            <span className="bg-gradient-to-b from-white via-white to-slate-500 bg-clip-text text-transparent">
              Verified.
            </span>
          </span>
        </h1>

        {/* Sub-headline */}
        <p className="animate-slide-up-delayed max-w-2xl mt-8 text-lg md:text-xl text-slate-400 leading-relaxed">
          AI-Powered Block Planning for Indian Railways. CP-SAT constraint optimization with
          cryptographic safety verification across{' '}
          <span className="text-white font-medium">1,000+ track kilometers</span> per division.
        </p>

        {/* CTA Buttons */}
        <div className="animate-slide-up-delayed flex flex-col sm:flex-row items-center gap-4 mt-12">
          <Link
            href="/dashboard"
            className="group relative flex items-center gap-3 text-base font-semibold px-8 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-[#020817] hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] transition-all duration-500"
          >
            <span>Enter Dashboard</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 -z-10" />
          </Link>

          <Link
            href="#features"
            className="group flex items-center gap-2 text-sm font-medium px-6 py-3.5 rounded-full border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all duration-300"
          >
            Explore Architecture
            <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Floating train illustration */}
        <div className="animate-float mt-16 relative">
          <div className="flex items-center gap-1 px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
            <div className="flex gap-3 items-center text-xs font-mono text-slate-500">
              <span className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                SOLVER: OPTIMAL
              </span>
              <span className="text-slate-700">│</span>
              <span className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" style={{ animationDelay: '1s' }} />
                SENTINEL: 10/10 PASSED
              </span>
              <span className="text-slate-700">│</span>
              <span className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: '0.5s' }} />
                LATENCY: 24.3s
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ METRICS RIBBON ============ */}
      <section className="relative z-10 border-y border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 py-6 md:py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x divide-white/[0.06]">
            {[
              { value: '≤ 35s', label: 'Optimization Latency (P95)', icon: Clock },
              { value: '100%', label: 'Deterministic Safety Gate', icon: ShieldCheck },
              { value: '3-Dept', label: 'Shadow Block Bundling', icon: GitMerge },
              { value: '< 45s', label: 'P0 Emergency Re-plan', icon: Zap },
            ].map((metric) => (
              <div key={metric.label} className="flex flex-col items-center text-center md:px-8">
                <metric.icon className="h-4 w-4 text-cyan-400/60 mb-2" />
                <div className="text-2xl md:text-3xl font-bold font-mono tracking-tight bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                  {metric.value}
                </div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mt-1.5">
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BENTO FEATURES GRID ============ */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 py-24 md:py-32">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-cyan-400/70 mb-4 px-3 py-1.5 rounded-full border border-cyan-400/10 bg-cyan-400/5">
            <Activity className="h-3 w-3" />
            Core Capabilities
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              Mathematical Precision.
            </span>
            <br />
            <span className="bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">
              Railway Safety.
            </span>
          </h2>
        </div>

        {/* Bento Grid — 2 large + 2 medium + 2 wide */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Card 1: CP-SAT Solver — Large */}
          <div className="lg:col-span-2 group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-10 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500">
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-[80px] group-hover:bg-cyan-500/10 transition-all duration-700" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <BrainCircuit className="h-5 w-5 text-cyan-400" />
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400/70">FR-007</span>
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-tight">
                CP-SAT Multi-Horizon Solver
              </h3>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-lg">
                Google OR-Tools constraint programming solver with interval-based scheduling.
                Produces mathematically bounded block plans across strategic 26-week, tactical weekly,
                and real-time operational horizons — warm-started from baseline configuration.
              </p>
              <div className="flex flex-wrap gap-2 mt-6">
                {['CP-SAT', 'Interval Scheduling', 'Warm Start', 'Multi-Horizon'].map((tag) => (
                  <span key={tag} className="text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border border-white/[0.06] text-slate-500 bg-white/[0.02]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Sentinel Safety */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500">
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-500/5 rounded-full blur-[60px] group-hover:bg-emerald-500/10 transition-all duration-700" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-emerald-400" />
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-emerald-400/70">FR-010</span>
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight">
                Sentinel Safety Gates
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                10-point deterministic G&SR + MILP verification. Fail-closed architecture — no plan
                reaches human operators without passing every safety check, bound to its exact content hash.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                {['G&SR-1→5', 'MILP-C1→5'].map((rule) => (
                  <div key={rule} className="flex items-center gap-2 text-xs font-mono text-emerald-400/60">
                    <ShieldCheck className="h-3 w-3" />
                    {rule}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Card 3: Cryptographic Ledger */}
          <div className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500">
            <div className="absolute top-0 left-0 w-60 h-60 bg-violet-500/5 rounded-full blur-[60px] group-hover:bg-violet-500/10 transition-all duration-700" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                  <ScrollText className="h-5 w-5 text-violet-400" />
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-violet-400/70">FR-022</span>
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight">
                Cryptographic Audit Ledger
              </h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                SHA-256 hash-chained, append-only relational audit trail.
                Tamper-evident logging of every approval, override, and state change with advisory-locked integrity.
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs font-mono text-violet-400/50">
                <Lock className="h-3 w-3" />
                <span>INSERT-only · Advisory-locked · Hash-chained</span>
              </div>
            </div>
          </div>

          {/* Card 4: Shadow Bundling — Wide */}
          <div className="lg:col-span-2 group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-10 hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-500">
            <div className="absolute bottom-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-[80px] group-hover:bg-amber-500/10 transition-all duration-700" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Layers3 className="h-5 w-5 text-amber-400" />
                </div>
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400/70">FR-008</span>
              </div>
              <h3 className="text-xl md:text-2xl font-bold mb-3 tracking-tight">
                Multi-Department Shadow Bundling
              </h3>
              <p className="text-slate-400 text-sm md:text-base leading-relaxed max-w-lg">
                Unifies Civil (Track), TRD (Traction), and S&T (Signal) maintenance demands into
                co-allocated &ldquo;shadow blocks&rdquo; — eliminating redundant line closures and maximizing
                asset uptime through window-containment spatial overlap detection.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                {[
                  { label: 'Civil · TMS', color: 'text-amber-400/70 border-amber-500/20 bg-amber-500/5' },
                  { label: 'TRD · TDMS', color: 'text-cyan-400/70 border-cyan-500/20 bg-cyan-500/5' },
                  { label: 'S&T · SMMS', color: 'text-emerald-400/70 border-emerald-500/20 bg-emerald-500/5' },
                ].map((dept) => (
                  <span key={dept.label} className={`text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border ${dept.color}`}>
                    {dept.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ ARCHITECTURE SECTION ============ */}
      <section id="architecture" className="relative z-10 border-y border-white/[0.06] bg-white/[0.01]">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Text */}
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-emerald-400/70 mb-4 px-3 py-1.5 rounded-full border border-emerald-400/10 bg-emerald-400/5">
                <Gauge className="h-3 w-3" />
                System Architecture
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                  Three Horizons.
                </span>
                <br />
                <span className="bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">
                  One Solver.
                </span>
              </h2>
              <p className="text-slate-400 leading-relaxed mb-8">
                RAIL-BLOC operates across three synchronized planning horizons — each feeding
                the next with progressively refined constraint data from TMS, TDMS, SMMS, WTT, and FOIS sources.
              </p>
              <div className="space-y-4">
                {[
                  { horizon: 'Strategic', period: '26-Week Rolling', desc: 'Corridor-level capacity allocation' },
                  { horizon: 'Tactical', period: 'Weekly Plan', desc: 'Minute-level slot assignments' },
                  { horizon: 'Operational', period: 'Real-Time', desc: 'Live dispatch with COA integration' },
                ].map((h, i) => (
                  <div key={h.horizon} className="flex items-start gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-white/[0.06] flex items-center justify-center text-sm font-mono font-bold text-cyan-400 shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{h.horizon}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-full">
                          {h.period}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">{h.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Visual — Data flow diagram */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 rounded-3xl blur-3xl" />
              <div className="relative rounded-2xl border border-white/[0.06] bg-[#0a0f1a] p-8 overflow-hidden">
                {/* Animated grid background */}
                <div className="absolute inset-0 opacity-[0.03]" style={{
                  backgroundImage: 'linear-gradient(rgba(6,182,212,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.6) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }} />

                <div className="relative space-y-4">
                  {/* Data sources */}
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-600 mb-2">Data Ingestion</div>
                  <div className="grid grid-cols-5 gap-2 mb-6">
                    {['TMS', 'TDMS', 'SMMS', 'WTT', 'FOIS'].map((src) => (
                      <div key={src} className="text-center py-2 px-1 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[10px] font-mono text-slate-400 hover:border-cyan-500/20 hover:text-cyan-400 transition-colors">
                        {src}
                      </div>
                    ))}
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-px h-6 bg-gradient-to-b from-white/10 to-cyan-500/30" />
                      <ChevronRight className="h-3 w-3 text-cyan-400/50 rotate-90" />
                    </div>
                  </div>

                  {/* Solver block */}
                  <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.03] text-center">
                    <div className="text-xs font-mono text-cyan-400 font-bold mb-1">CP-SAT SOLVER</div>
                    <div className="text-[10px] text-slate-500">Interval-based multi-horizon optimization</div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-px h-6 bg-gradient-to-b from-cyan-500/30 to-emerald-500/30" />
                      <ChevronRight className="h-3 w-3 text-emerald-400/50 rotate-90" />
                    </div>
                  </div>

                  {/* Sentinel block */}
                  <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
                    <div className="text-xs font-mono text-emerald-400 font-bold mb-1">SENTINEL VERIFICATION</div>
                    <div className="text-[10px] text-slate-500">10-point G&SR + MILP deterministic checks</div>
                  </div>

                  {/* Arrow */}
                  <div className="flex justify-center py-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-px h-6 bg-gradient-to-b from-emerald-500/30 to-violet-500/30" />
                      <ChevronRight className="h-3 w-3 text-violet-400/50 rotate-90" />
                    </div>
                  </div>

                  {/* Output */}
                  <div className="grid grid-cols-3 gap-2">
                    {['Sr. DOM Approval', 'DRM Authorization', 'COA Dispatch'].map((stage) => (
                      <div key={stage} className="text-center py-2.5 px-1 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[10px] font-mono text-slate-400">
                        {stage}
                      </div>
                    ))}
                  </div>

                  {/* Ledger */}
                  <div className="mt-4 p-3 rounded-lg border border-violet-500/10 bg-violet-500/[0.02] flex items-center justify-center gap-2">
                    <Lock className="h-3 w-3 text-violet-400/50" />
                    <span className="text-[10px] font-mono text-violet-400/50">SHA-256 HASH-CHAINED AUDIT LEDGER</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SAFETY SECTION ============ */}
      <section id="safety" className="relative z-10 max-w-6xl mx-auto px-6 py-24 md:py-32">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-emerald-400/70 mb-4 px-3 py-1.5 rounded-full border border-emerald-400/10 bg-emerald-400/5">
            <Shield className="h-3 w-3" />
            Safety Architecture
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              Fail-Closed by Design.
            </span>
          </h2>
          <p className="max-w-2xl mx-auto mt-4 text-slate-400">
            Every plan — routine and emergency — must pass deterministic Sentinel verification
            before reaching human operators. No exceptions. No overrides.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              rule: 'G&SR-1',
              title: 'Absolute Block Exclusion',
              desc: 'No passenger path conflicts within the blocked section window.',
              icon: Lock,
            },
            {
              rule: 'G&SR-2',
              title: 'Interlocking Precedence',
              desc: 'Station Master and Controller acknowledgment for S&T disconnections.',
              icon: ShieldCheck,
            },
            {
              rule: 'G&SR-3',
              title: 'Fail-Closed Consistency',
              desc: 'System defaults to safe state on any verification ambiguity.',
              icon: Shield,
            },
            {
              rule: 'G&SR-4',
              title: 'Power Isolation Boundary',
              desc: 'TRD plans validated against OHE feeding-section boundaries.',
              icon: Zap,
            },
            {
              rule: 'G&SR-5',
              title: 'Headway Margin ≥ 15min',
              desc: 'Minimum safety buffer enforced at block possession boundaries.',
              icon: Clock,
            },
            {
              rule: 'MILP-C1→C5',
              title: 'Constraint Satisfaction',
              desc: 'Section exclusion, maintenance enclosure, shadow bundling, duration, and machine conservation.',
              icon: BrainCircuit,
            },
          ].map((check) => (
            <div key={check.rule} className="group p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/10 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                  <check.icon className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400/50">{check.rule}</span>
              </div>
              <h3 className="font-semibold mb-2 text-sm">{check.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{check.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-24 md:py-32 text-center">
          {/* Glow */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px]" />
          </div>

          <h2 className="relative text-3xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              Ready to Optimize.
            </span>
          </h2>
          <p className="relative text-slate-400 mb-10 max-w-lg mx-auto">
            Experience AI-powered block planning with cryptographic safety verification.
            Built for Indian Railways. Engineered for trust.
          </p>
          <Link
            href="/dashboard"
            className="relative group inline-flex items-center gap-3 text-base font-semibold px-10 py-4 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-[#020817] hover:shadow-[0_0_50px_rgba(6,182,212,0.3)] transition-all duration-500"
          >
            <span>Launch RAIL-BLOC</span>
            <ArrowRight className="h-5 w-5 group-hover:translate-x-1.5 transition-transform duration-300" />
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 -z-10" />
          </Link>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#020817]">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-md bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center">
                <Train className="h-4 w-4 text-[#020817]" strokeWidth={2.5} />
              </div>
              <span className="text-sm font-bold">RAIL-BLOC</span>
              <span className="text-[10px] font-mono text-slate-600">v1.1.0</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-600">
              <span>SIH26027 · Transportation & Logistics</span>
              <span className="hidden md:inline">·</span>
              <span className="hidden md:inline">Ministry of Railways, Government of India</span>
            </div>
            <div className="text-[10px] font-mono text-slate-700 tracking-wider">
              SIMULATED DATA · DEMONSTRATION BUILD
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

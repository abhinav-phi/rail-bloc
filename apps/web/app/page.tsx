'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { VbTrain } from '@/components/showcase/vb-train';
import { DotField } from '@/components/showcase/dot-field';
import { Reveal } from '@/components/showcase/reveal';
import { ThemeToggle } from '@/components/shell/theme-toggle';

/** Public showcase landing — "control room, not dashboard template".
 * Dark brass-instrument skin, cinematic VB train entrance, documentary
 * restraint everywhere else. Purely visual: the only wiring is /login. */

function CountUp({
  target,
  decimals = 0,
}: {
  target: number;
  decimals?: number;
}) {
  const [value, setValue] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const duration = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return (
    <>
      {value.toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  );
}

const STATIONS = ['BPL', 'ET', 'ETX', 'BINA', 'ITR', 'NGP', 'DLI', 'AII'];

const PIPELINE = [
  { id: '01', name: 'NEXUS', line: 'Ingest every demand', fig: '2,842' },
  { id: '02', name: 'OPTIMA', line: 'Solve the network', fig: '0.8s' },
  { id: '03', name: 'SENTINEL', line: 'Bound the risk', fig: '10 / 10' },
  { id: '04', name: 'APPROVAL', line: 'Human authority', fig: '3 gates' },
  { id: '05', name: 'CHRONICLE', line: 'Seal the record', fig: 'SHA-256' },
];

const CHAIN = [
  { id: '00', hash: 'GENESIS', tag: 'ORIGIN' },
  { id: '01', hash: '6a2d11fb', tag: 'DEMAND' },
  { id: '02', hash: '8d10f2cc', tag: 'SOLVE' },
  { id: '03', hash: 'b8c4409a', tag: 'APPROVE' },
  { id: '04', hash: 'a3f9c1e7', tag: 'SEALED' },
];

const SCREENS = [
  {
    id: '01',
    name: 'Operations',
    line: 'Network health at a glance',
    href: '/dashboard',
  },
  {
    id: '05',
    name: 'Corridor map',
    line: 'Every section, live',
    href: '/corridor-map',
  },
  {
    id: '07',
    name: '26-week horizon',
    line: 'Plan beyond the week',
    href: '/planner/26-week',
  },
];

// Seeded demo scenario — exact counts produced by data/generators (seeds
// 42/52/53, verified in the seeder log: '12 sections, 286 demands, 276
// paths'). Declared as SEEDED SCENARIO on the stat cards so no figure can
// be mistaken for a live production metric (Rules R6.6).
const SEEDED = { demands: 286, sections: 12 };

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="grain-overlay" aria-hidden="true" />

      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/90 px-6 py-4 backdrop-blur-sm lg:px-12">
        <div className="flex items-baseline gap-4">
          <span className="text-sm font-semibold tracking-[0.14em]">
            RAIL-BLOC
          </span>
          <span className="hidden font-mono text-[10px] tracking-[0.22em] text-muted-foreground sm:inline">
            CONTROL / 01
          </span>
        </div>
        <nav className="flex items-center gap-6 text-[13px] text-muted-foreground">
          <a
            href="#pipeline"
            className="hidden transition-colors hover:text-foreground sm:inline"
          >
            Pipeline
          </a>
          <a
            href="#chronicle"
            className="hidden transition-colors hover:text-foreground sm:inline"
          >
            Chronicle
          </a>
          <a
            href="#screens"
            className="hidden transition-colors hover:text-foreground sm:inline"
          >
            Screens
          </a>
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-sm bg-brass px-4 py-2 text-[13px] font-semibold text-brass-foreground transition-colors hover:opacity-90"
          >
            Enter control room
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-[1200px] px-6 pt-16 lg:px-12 lg:pt-24">
        <DotField className="pointer-events-none absolute -inset-x-6 -top-16 h-[720px] w-[calc(100%+3rem)]" />
        <p className="font-mono text-[11px] tracking-[0.28em] text-muted-foreground">
          INDIAN RAILWAYS / DLI DIVISION · EST. 2024
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-5xl lg:text-6xl">
          Block the line.{' '}
          <em className="font-serif font-normal italic text-brass">
            Never the nation.
          </em>
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">
          AI-assisted maintenance block scheduling for Indian Railways — bounded
          by Sentinel safety validation and sealed by a three-officer human
          approval chain.
        </p>

        <div className="mt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              value: <CountUp target={SEEDED.demands} />,
              label: 'demands unified',
              real: true,
            },
            { value: '10 / 10', label: 'sentinel checks', real: true },
            {
              value: <CountUp target={SEEDED.sections} />,
              label: 'sections monitored',
              real: true,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-sm border border-border bg-secondary px-5 py-4"
            >
              <b className="block font-mono text-2xl font-medium tabular-nums tracking-tight">
                {stat.value}
              </b>
              <span className="mt-1 block text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                {stat.label}
                <span className="ml-1.5 normal-case tracking-normal text-brass/80">
                  · seeded
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Train entrance */}
        <div
          className="relative mt-2 h-[220px] sm:h-[250px]"
          aria-hidden="true"
        >
          <div className="vb-train-wrap absolute inset-0 flex items-center justify-end">
            <div className="w-full max-w-[760px]">
              <VbTrain className="h-auto w-full drop-shadow-[0_20px_14px_rgba(0,0,0,0.45)]" />
            </div>
          </div>
        </div>
      </section>

      {/* Station ticker */}
      <div
        className="overflow-hidden border-y border-border py-3"
        aria-hidden="true"
      >
        <div className="atlas-marquee whitespace-nowrap font-mono text-xs tracking-[0.3em] text-muted-foreground opacity-55">
          {[0, 1].map((copy) => (
            <span key={copy}>
              {STATIONS.map((s) => (
                <span key={`${copy}-${s}`}>
                  {s} <span className="mx-3 text-brass/70">◆</span>{' '}
                </span>
              ))}
              {STATIONS.map((s) => (
                <span key={`b-${copy}-${s}`}>
                  {s} <span className="mx-3 text-brass/70">◆</span>{' '}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Pipeline */}
      <section
        id="pipeline"
        className="mx-auto max-w-[1200px] px-6 pt-20 lg:px-12"
      >
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground">
            THE DECISION PIPELINE / 01—05
          </p>
          <div className="mt-6 grid grid-cols-1 gap-x-6 sm:grid-cols-3 lg:grid-cols-5">
            {PIPELINE.map((stage) => (
              <div
                key={stage.id}
                className="relative border-t border-dashed border-border pt-5"
              >
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-[-3.5px] h-[7px] w-[7px] rounded-[1px] bg-brass"
                />
                <i className="font-mono text-[10px] not-italic text-muted-foreground">
                  {stage.id}
                </i>
                <b className="mt-1.5 block text-sm font-semibold tracking-[0.14em]">
                  {stage.name}
                </b>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {stage.line}
                </p>
                <span className="mt-2 block font-mono text-xs tabular-nums text-brass">
                  {stage.fig}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Chronicle */}
      <section
        id="chronicle"
        className="mx-auto max-w-[1200px] px-6 pt-24 lg:px-12"
      >
        <Reveal>
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground">
                CHRONICLE / TAMPER-EVIDENT BY DESIGN
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
                Trust is a{' '}
                <em className="font-serif font-normal italic text-brass">
                  visible
                </em>{' '}
                state.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
                Every decision — from the first demand to the final transmission
                — is sealed into a human-readable hash chain. Append-only,
                cryptographically bound, verifiable by anyone on the operations
                floor.
              </p>
              <Link
                href="/login"
                className="mt-6 inline-flex items-center gap-2 rounded-sm border border-brass/50 px-4 py-2 text-[13px] font-medium text-brass transition-colors hover:bg-brass/10"
              >
                Explore the ledger
                <span aria-hidden="true">→</span>
              </Link>
            </div>
            <ol className="relative space-y-0 border-l border-dashed border-border pl-6">
              {CHAIN.map((node) => (
                <li key={node.id} className="relative py-2.5">
                  <span
                    aria-hidden="true"
                    className="absolute left-[-27.5px] top-1/2 h-[7px] w-[7px] -translate-y-1/2 rounded-[1px] bg-brass"
                  />
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {node.id}
                    </span>
                    <span className="font-mono text-sm font-medium tabular-nums text-brass">
                      {node.hash}
                    </span>
                    <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                      · {node.tag}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>
      </section>

      {/* Screens teaser */}
      <section
        id="screens"
        className="mx-auto max-w-[1200px] px-6 py-24 lg:px-12"
      >
        <Reveal>
          <p className="font-mono text-[11px] tracking-[0.25em] text-muted-foreground">
            ONE SYSTEM / MANY LENSES
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
            A cockpit for every decision.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {SCREENS.map((screen) => (
              <Link
                key={screen.id}
                href={screen.href}
                className="group rounded-sm border border-border bg-card p-5 transition-colors hover:border-brass/50"
              >
                <i className="font-mono text-[10px] not-italic text-muted-foreground">
                  {screen.id}
                </i>
                <b className="mt-2 block text-sm font-semibold tracking-wide">
                  {screen.name}
                </b>
                <p className="mt-1 text-xs text-muted-foreground">
                  {screen.line}
                </p>
                <span
                  aria-hidden="true"
                  className="mt-4 inline-block font-mono text-xs text-brass opacity-0 transition-opacity group-hover:opacity-100"
                >
                  ENTER →
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center lg:px-12">
          <div>
            <span className="text-sm font-semibold tracking-[0.14em]">
              RAIL-BLOC
            </span>
            <p className="mt-1 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
              A DESIGN SHOWCASE FOR INDIAN RAILWAYS
            </p>
          </div>
          <Link
            href="/login"
            className="rounded-sm bg-brass px-4 py-2 text-[13px] font-semibold text-brass-foreground transition-colors hover:opacity-90"
          >
            Enter control room
          </Link>
        </div>
      </footer>
    </div>
  );
}

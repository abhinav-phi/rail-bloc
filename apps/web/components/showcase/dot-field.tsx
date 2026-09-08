'use client';

import React, { useEffect, useRef } from 'react';

/** Cursor-reactive dot field (showcase layer only). Hand-rolled canvas —
 * no dependency. Base dots sit near-invisible (slate ~8%); dots inside the
 * pointer radius tint brass and brighten with eased falloff. Freezes to a
 * static grid under prefers-reduced-motion; pauses when tab is hidden.
 * Deliberately NOT used on console pages (Design.md: zero visual noise
 * near safety data). */
export function DotField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const SPACING = 28;
    const RADIUS = 180;
    const MAX_ALPHA = 0.6;
    const BASE_ALPHA = 0.08;
    // brass #C17F3E → r193 g127 b62
    const BRASS = [193, 127, 62] as const;
    const SLATE = [120, 134, 156] as const;

    let raf = 0;
    let running = true;
    const pointer = { x: -9999, y: -9999 };
    let dots: { x: number; y: number }[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      for (let y = SPACING / 2; y < rect.height; y += SPACING) {
        for (let x = SPACING / 2; x < rect.width; x += SPACING) {
          dots.push({ x, y });
        }
      }
      if (reduced) draw(); // static grid once
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      for (const dot of dots) {
        const dx = dot.x - pointer.x;
        const dy = dot.y - pointer.y;
        const dist = Math.hypot(dx, dy);
        // eased falloff inside the pointer radius
        const t = dist < RADIUS ? 1 - dist / RADIUS : 0;
        const eased = t * t * (3 - 2 * t); // smoothstep
        const [r, g, b] = [
          Math.round(SLATE[0] + (BRASS[0] - SLATE[0]) * eased),
          Math.round(SLATE[1] + (BRASS[1] - SLATE[1]) * eased),
          Math.round(SLATE[2] + (BRASS[2] - SLATE[2]) * eased),
        ];
        const alpha = BASE_ALPHA + (MAX_ALPHA - BASE_ALPHA) * eased;
        const radius = 1 + eased * 0.8;
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      if (!running) return;
      draw();
      raf = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };
    const onVisibility = () => {
      running = !document.hidden;
      if (running && !reduced) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(loop);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    if (!reduced) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerleave', onLeave);
      raf = requestAnimationFrame(loop);
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={
        className ?? 'pointer-events-none absolute inset-0 h-full w-full'
      }
    />
  );
}

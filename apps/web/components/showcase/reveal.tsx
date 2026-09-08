'use client';

import React, { useEffect, useRef, useState } from 'react';

/** Scroll-reveal wrapper — fade-up once when the section enters the viewport.
 * Emergent-style depth for the showcase layer; reduced-motion users get the
 * content immediately (no animation, no hidden state). */
export function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: React.ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={
        (className ?? '') +
        ' transition-all duration-500 ease-out ' +
        (shown ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0')
      }
      style={{ transitionDelay: shown ? `${delayMs}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}

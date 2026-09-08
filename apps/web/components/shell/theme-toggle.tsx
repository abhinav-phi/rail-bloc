'use client';

import React, { useEffect, useState } from 'react';

/** Sun/moon theme toggle — dark control-room is primary; light = railway
 * skyblue. Persists to localStorage; the root layout bootstraps the class
 * before first paint so there is no flash. Pure visual — no wiring touched. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<'atlas-dark' | 'atlas-light' | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    setTheme(
      root.classList.contains('atlas-light') ? 'atlas-light' : 'atlas-dark',
    );
  }, []);

  const toggle = () => {
    const root = document.documentElement;
    const next =
      theme === 'atlas-light' ? 'atlas-dark' : ('atlas-light' as const);
    root.classList.remove('atlas-dark', 'atlas-light');
    root.classList.add(next);
    try {
      localStorage.setItem('railbloc-theme', next);
    } catch {
      /* private mode: theme still applies for this page lifetime */
    }
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light / dark theme"
      title="Toggle theme"
      className="inline-flex h-8 w-9 items-center justify-center rounded-sm border border-border text-muted-foreground transition-colors hover:border-brass/50 hover:text-brass"
    >
      {theme === 'atlas-light' ? (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
          <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
          <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
        </svg>
      )}
    </button>
  );
}

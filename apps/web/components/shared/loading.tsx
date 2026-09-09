/** Shared loading primitives — brass instrument style, reduced-motion safe.
 * One definition (Spinner, Skeleton); pages compose rather than copy. */
'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/** Brass spinner. Purely decorative — pair with a text label for a11y. */
export function Spinner({
  className,
  size = 16,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={cn('atlas-spinner', className)}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      role="presentation"
    >
      <circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M8 1.5 A6.5 6.5 0 0 1 14.5 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Shimmer placeholder block. `rows` renders stacked bars; width/height fixed
 * per row so skeletons never shift real content on load. */
export function Skeleton({
  className,
  rows = 1,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn('grid gap-2', className)} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4 w-full rounded-sm"
          style={{ opacity: 1 - i * 0.15 }}
        />
      ))}
    </div>
  );
}

/** Skeleton card — header line + body rows, the common KPI/list-card shape. */
export function SkeletonCard({
  className,
  rows = 3,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div
      className={cn('rounded-sm border border-border bg-card p-4', className)}
      aria-hidden="true"
    >
      <div className="skeleton mb-3 h-3 w-24 rounded-sm" />
      <div className="skeleton mb-2 h-8 w-32 rounded-sm" />
      <Skeleton rows={rows - 1} />
    </div>
  );
}

import React from 'react';

/** Planner shell — the Atlas planner provides its own horizon tabs and
 *  solve controls, so this layout is a thin content frame. */
export default function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-full">{children}</div>;
}

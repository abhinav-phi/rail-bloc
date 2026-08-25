import React from "react";
import { useLive } from "../live";

/** Design.md §3 — persistent, non-dismissible overlays and watermarks.
 *  STALE overlay disables ALL action buttons while the live feed is down. */
export const StaleOverlay: React.FC = () => {
  const { stale } = useLive();
  if (!stale) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 bg-status-stale px-4 py-2 text-sm font-semibold text-white shadow-lg">
      <span aria-hidden>🕓</span>
      <span>STALE DATA — actions disabled</span>
    </div>
  );
};

/** Rules.md §5 — persistent, non-dismissible SIMULATED DATA watermark. */
export const SimulatedWatermark: React.FC = () => (
  <div className="pointer-events-none fixed bottom-4 right-4 z-40 select-none rounded border border-border-subtle bg-bg-surface/70 px-3 py-1 text-xs font-bold tracking-widest text-text-secondary">
    SIMULATED DATA
  </div>
);

const STATUS_STYLES: Record<string, { color: string; icon: string; label: string }> = {
  DRAFT: { color: "text-text-secondary", icon: "○", label: "DRAFT" },
  SENTINEL_PASSED: { color: "text-status-active", icon: "🛡", label: "SENTINEL_PASSED" },
  APPROVED_SR_DOM: { color: "text-accent-trd", icon: "✔", label: "APPROVED_SR_DOM" },
  AUTHORIZED_DRM: { color: "text-accent-civil", icon: "🔒", label: "AUTHORIZED_DRM" },
  TRANSMITTED_COA: { color: "text-accent-trd", icon: "📡", label: "TRANSMITTED_COA" },
  ACTIVE_GRANTED: { color: "text-status-blocked", icon: "⛔", label: "ACTIVE" },
  COMPLETED_FITNESS: { color: "text-status-active", icon: "✓", label: "COMPLETED" },
  ARCHIVED_SEALED: { color: "text-text-secondary", icon: "🗄", label: "SEALED" },
  SUPERSEDED: { color: "text-text-secondary", icon: "⤴", label: "SUPERSEDED" },
  SUPERSEDED_EMERGENCY: { color: "text-status-caution", icon: "⚠", label: "SUPERSEDED_EMERGENCY" },
  CANCELLED: { color: "text-text-secondary", icon: "✕", label: "CANCELLED" },
  FAILED_ESCALATE: { color: "text-status-blocked", icon: "✗", label: "FAILED_ESCALATE" },
  PROVISIONAL: { color: "text-status-provisional", icon: "◆", label: "PROVISIONAL" },
};

/** WCAG 1.4.1 — state never by color alone: icon + text + color. */
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_STYLES[status] ?? { color: "text-text-secondary", icon: "•", label: status };
  return (
    <span className={`inline-flex items-center gap-1 rounded border border-border-subtle bg-bg-primary px-2 py-0.5 font-mono text-xs font-semibold ${s.color}`}>
      <span aria-hidden>{s.icon}</span>
      <span>{s.label}</span>
    </span>
  );
};

export const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`rounded-lg border border-border-subtle bg-bg-surface p-4 ${className ?? ""}`}>
    {title && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">{title}</h3>}
    {children}
  </div>
);

/** All action buttons are disabled while the SSE stream is stale (Design.md §3). */
export const ActionButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (props) => {
  const { stale } = useLive();
  return (
    <button
      {...props}
      disabled={props.disabled || stale}
      title={stale ? "Disabled: STALE DATA" : props.title}
      className={`rounded px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        props.className ?? "bg-accent-trd/20 text-accent-trd hover:bg-accent-trd/30"
      }`}
    />
  );
};

import React, { useEffect } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { LiveProvider, useLive } from "./live";
import { clearToken, getToken } from "./api";
import { StaleOverlay, SimulatedWatermark } from "./components/common";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { CorridorMap } from "./pages/CorridorMap";
import { StringChart } from "./pages/StringChart";
import { Planner26Week } from "./pages/Planner26Week";
import { PlannerWeekly } from "./pages/PlannerWeekly";
import { Approvals } from "./pages/Approvals";
import { Disruptions } from "./pages/Disruptions";
import { AuditLedger } from "./pages/AuditLedger";

interface MeInfo {
  username: string;
  role: string;
  division: string;
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", roles: null },
  { to: "/corridor-map", label: "Corridor Map", roles: null },
  { to: "/string-chart", label: "String Chart", roles: null },
  { to: "/planner/26-week", label: "26-Week Calendar", roles: null },
  { to: "/planner/weekly", label: "Weekly Planner", roles: ["SR_DOM", "ADMIN", "ENGINEER"] },
  { to: "/approvals", label: "Approvals", roles: ["SR_DOM", "DRM", "ADMIN"] },
  { to: "/disruptions", label: "Disruptions", roles: ["CONTROLLER", "SR_DOM", "DRM", "ENGINEER", "ADMIN"] },
  { to: "/audit-ledger", label: "Audit Ledger", roles: ["AUDITOR", "ADMIN"] },
];

const Shell: React.FC = () => {
  const nav = useNavigate();
  const { stale, connected } = useLive();

  useEffect(() => {
    if (!getToken()) nav("/login");
  }, [nav]);

  const me = parseJwt(getToken());

  function parseJwt(token: string | null): MeInfo | null {
    if (!token) return null;
    try {
      const p = token.split(".")[1] ?? "";
      const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
      return JSON.parse(decodeURIComponent(escape(window.atob(b64)))) as MeInfo;
    } catch {
      return null;
    }
  }

  const logout = () => {
    clearToken();
    nav("/login");
  };

  return (
    <div className="flex min-h-screen bg-bg-primary">
      <aside className="flex w-60 flex-col border-r border-border-subtle bg-bg-surface">
        <div className="border-b border-border-subtle px-4 py-4">
          <h1 className="text-lg font-bold tracking-wide text-text-primary">RAIL-BLOC</h1>
          <p className="text-[10px] text-text-secondary">Atlas Spatial Console</p>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {NAV.filter((n) => !n.roles || !me || n.roles.includes(me.role)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `block rounded px-3 py-2 text-sm ${isActive ? "bg-accent-trd/15 font-semibold text-accent-trd" : "text-text-secondary hover:bg-bg-primary hover:text-text-primary"}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border-subtle p-3 text-xs">
          {me && (
            <p className="mb-2 font-mono text-text-primary">
              {me.username}
              <span className="ml-1 rounded bg-bg-primary px-1 text-[10px] text-accent-civil">{me.role}</span>
              <span className="ml-1 text-text-secondary">/{me.division}</span>
            </p>
          )}
          <p className={`mb-2 font-mono text-[10px] ${stale ? "text-status-stale" : "text-status-active"}`}>
            {stale ? "🕓 STALE DATA" : connected ? "● live feed" : "… connecting"}
          </p>
          <button onClick={logout} className="w-full rounded border border-border-subtle py-1 text-text-secondary hover:text-text-primary">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/corridor-map" element={<CorridorMap />} />
          <Route path="/string-chart" element={<StringChart />} />
          <Route path="/planner/26-week" element={<Planner26Week />} />
          <Route path="/planner/weekly" element={<PlannerWeekly />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/disruptions" element={<Disruptions />} />
          <Route path="/audit-ledger" element={<AuditLedger />} />
        </Routes>
      </main>

      <StaleOverlay />
      <SimulatedWatermark />
    </div>
  );
};

export const App: React.FC = () => (
  <LiveProvider>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<Shell />} />
    </Routes>
  </LiveProvider>
);

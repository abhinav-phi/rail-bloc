import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, getToken, setToken } from "../api";

interface TokenOut {
  access_token: string;
  role: string;
  division: string;
}

export const Login: React.FC = () => {
  const [username, setUsername] = useState("srdom_dli");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (getToken()) nav("/dashboard");
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const out = await api.post<TokenOut>("/api/v1/auth/login", { username, password });
      setToken(out.access_token);
      nav("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <form onSubmit={submit} className="w-96 rounded-lg border border-border-subtle bg-bg-surface p-6">
        <h1 className="mb-1 text-xl font-bold text-text-primary">RAIL-BLOC</h1>
        <p className="mb-6 text-xs text-text-secondary">
          Atlas Console — SIH26027 · all data is SIMULATED
        </p>
        <label className="mb-2 block text-xs uppercase tracking-wider text-text-secondary">Username</label>
        <input
          className="mb-4 w-full rounded border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent-trd"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <label className="mb-2 block text-xs uppercase tracking-wider text-text-secondary">Password</label>
        <input
          type="password"
          className="mb-4 w-full rounded border border-border-subtle bg-bg-primary px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent-trd"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="SEED_PASSWORD (default: railbloc)"
        />
        {error && <p className="mb-3 rounded bg-status-blocked/20 px-3 py-2 text-xs text-status-blocked">{error}</p>}
        <button type="submit" className="w-full rounded bg-accent-trd py-2 font-semibold text-bg-primary hover:brightness-110">
          Sign in
        </button>
      </form>
    </div>
  );
};

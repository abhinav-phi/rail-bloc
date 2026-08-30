'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Persona, PersonaRole } from '@/lib/types';
import { api, getToken, setToken, clearToken, parseJwt } from '@/lib/api';

interface PersonaContextState {
  persona: Persona | null;
  isAuthenticated: boolean;
  /** Real API login with username/password. Falls back to demo mode if backend unavailable. */
  login: (credentials: { username: string; password: string }) => Promise<void>;
  /** Demo-persona login — sets persona directly without hitting the API. */
  loginAsDemo: (demo: {
    id: string;
    name: string;
    role: string;
    division: string;
    badge: string;
  }) => void;
  logout: () => void;
}

const PersonaContext = createContext<PersonaContextState | undefined>(
  undefined,
);

/** Map display-role strings to the PersonaRole union. */
function toPersonaRole(role: string): PersonaRole {
  const map: Record<string, PersonaRole> = {
    SR_DOM: 'SR_DOM',
    'Sr. DOM': 'SR_DOM',
    DRM: 'DRM',
    CHIEF_CONTROLLER: 'CHIEF_CONTROLLER',
    'Chief Controller': 'CHIEF_CONTROLLER',
    SR_DEN: 'SR_DEN',
    SSE: 'SSE',
    'SSE Engineer': 'SSE',
  };
  return map[role] ?? 'SR_DOM';
}

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<Persona | null>(null);

  // Restore session from existing JWT on mount
  useEffect(() => {
    const token = getToken();
    if (token) {
      const me = parseJwt(token);
      if (me) {
        setPersona({
          id: me.username,
          name: me.username,
          role: toPersonaRole(me.role),
          division: me.division,
          divisionId: me.division,
          badge: '',
        });
      }
    }
  }, []);

  const login = async (credentials: { username: string; password: string }) => {
    const resp = await api.post<{ access_token: string }>(
      '/api/v1/auth/login',
      credentials,
    );
    setToken(resp.access_token);
    const me = parseJwt(resp.access_token);
    if (me) {
      setPersona({
        id: me.username,
        name: me.username,
        role: toPersonaRole(me.role),
        division: me.division,
        divisionId: me.division,
        badge: '',
      });
    }
  };

  /** Demo-persona login — no API call, sets persona directly. */
  const loginAsDemo = (demo: {
    id: string;
    name: string;
    role: string;
    division: string;
    badge: string;
  }) => {
    setPersona({
      id: demo.id,
      name: demo.name,
      role: toPersonaRole(demo.role),
      division: demo.division,
      divisionId: demo.division.replace(/\s+Division$/, ''),
      badge: demo.badge,
    });
  };

  const logout = () => {
    clearToken();
    setPersona(null);
  };

  return (
    <PersonaContext.Provider
      value={{
        persona,
        isAuthenticated: !!persona,
        login,
        loginAsDemo,
        logout,
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    throw new Error('usePersona must be used within a PersonaProvider');
  }
  return context;
}

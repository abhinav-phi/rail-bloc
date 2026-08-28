'use client';

import React, { createContext, useContext, useState } from 'react';
import { Persona } from '@/lib/types';

interface PersonaContextState {
  persona: Persona | null;
  isAuthenticated: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
}

const PersonaContext = createContext<PersonaContextState | undefined>(undefined);

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersona] = useState<Persona | null>(null);

  const login = async (credentials: any) => {
    // Mock login
    setPersona({
      id: 'usr_1',
      name: 'John Doe',
      role: 'SR_DOM',
      division: 'Delhi',
      divisionId: 'DLI',
      badge: 'DOM-1234'
    });
  };

  const logout = () => {
    setPersona(null);
  };

  return (
    <PersonaContext.Provider
      value={{
        persona,
        isAuthenticated: !!persona,
        login,
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

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePersona } from '@/context/persona-context';
import { Button } from '@/components/ui/button';
import { Train, Shield } from 'lucide-react';

const DEMO_PERSONAS = [
  { id: 'sr-dom', name: 'R. K. Sharma', role: 'Sr. DOM', division: 'DLI Division', badge: 'Sr.DOM/DLI' },
  { id: 'drm', name: 'Sunita Verma', role: 'DRM', division: 'DLI Division', badge: 'DRM/DLI' },
  { id: 'chief-controller', name: 'A. P. Singh', role: 'Chief Controller', division: 'DLI Division', badge: 'CHC/DLI' },
  { id: 'sse-engineer', name: 'Meena Nair', role: 'SSE Engineer', division: 'DLI Division', badge: 'SSE/S&T' },
];

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = usePersona();
  const router = useRouter();

  const handleLogin = async (persona: typeof DEMO_PERSONAS[0]) => {
    setIsLoading(true);
    await login(persona);
    router.push('/dashboard');
  };

  return (
    <div className="w-full max-w-md p-8 border rounded-lg bg-card text-card-foreground shadow-lg">
      <div className="flex items-center justify-center gap-3 mb-2">
        <Train className="h-8 w-8 text-primary" />
        <h1 className="text-2xl font-bold">RAIL-BLOC</h1>
      </div>
      <p className="text-muted-foreground text-center mb-8 text-sm">
        AI-Powered Block Planning System — Select a persona to begin.
      </p>

      <div className="flex flex-col gap-3">
        {DEMO_PERSONAS.map((persona) => (
          <Button
            key={persona.id}
            variant="outline"
            className="w-full h-auto py-3 px-4 justify-start gap-3 hover:bg-accent/50 transition-colors"
            onClick={() => handleLogin(persona)}
            disabled={isLoading}
          >
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="font-semibold">{persona.name}</div>
              <div className="text-xs text-muted-foreground">
                {persona.role} • {persona.division}
              </div>
            </div>
            <span className="ml-auto font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {persona.badge}
            </span>
          </Button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center mt-6">
        Demo mode — all data is simulated (B1-relative).
      </p>
    </div>
  );
}

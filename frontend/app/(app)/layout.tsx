import { PersonaProvider } from '@/context/persona-context';
import { SSEProvider } from '@/context/sse-context';
import { SolverProvider } from '@/context/solver-context';
import { Header } from '@/components/shell/header';
import { Sidebar } from '@/components/shell/sidebar';
import { StaleStateOverlay } from '@/components/shell/stale-state-overlay';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersonaProvider>
      <SSEProvider>
        <SolverProvider>
          <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
            <Header />
            <div className="flex flex-1 overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto relative">
                <StaleStateOverlay />
                {children}
              </main>
            </div>
          </div>
        </SolverProvider>
      </SSEProvider>
    </PersonaProvider>
  );
}

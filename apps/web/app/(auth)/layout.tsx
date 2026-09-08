import { PersonaProvider } from '@/context/persona-context';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PersonaProvider>
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        {children}
      </div>
    </PersonaProvider>
  );
}

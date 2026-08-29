'use client';

import React from 'react';

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled app render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
          <div className="mx-auto max-w-xl rounded-xl border border-red-500/40 bg-red-950/30 p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-red-200">
              Something went wrong
            </h2>
            <p className="mt-3 text-sm text-slate-300">
              The app hit an unexpected render error. Refresh the page to
              continue.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

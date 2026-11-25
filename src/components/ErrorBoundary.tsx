import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Catches render crashes so users see a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-[60vh] place-items-center px-6">
        <div className="card max-w-md p-8 text-center">
          <h2 className="text-lg font-bold">Something went wrong on this page</h2>
          <p className="mt-2 text-sm text-ink-500">Your data is safe. Reload the page to continue — if it keeps happening, go back to the dashboard.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button onClick={() => window.location.reload()} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Reload
            </button>
            <a href="/app" className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-lavender-50">
              Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}

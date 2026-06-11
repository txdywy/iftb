import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="rounded-[8px] border border-danger/40 bg-danger/10 p-6 text-center">
          <p className="text-sm text-red-100">渲染出错</p>
          <p className="mt-2 font-mono text-xs text-red-200/70">{this.state.error?.message}</p>
          <button
            className="mt-4 rounded-[6px] bg-line/20 px-4 py-2 text-sm text-line hover:bg-line/30"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

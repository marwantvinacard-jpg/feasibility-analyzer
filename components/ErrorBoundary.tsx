import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level render-error guard. Without this, any uncaught error thrown
 * during render (a bad API response shape, a null ref, etc.) unmounts the
 * whole React tree and leaves the user staring at a blank white page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ error: null });
    window.location.assign('/');
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center bg-[#FAFAFA] px-6"
        >
          <div className="max-w-md w-full text-center">
            <h1 className="font-serif text-2xl text-charcoal mb-3">
              Something went wrong
            </h1>
            <p className="font-sans text-sm text-gray-600 mb-6">
              Lumina Studio hit an unexpected error. Your work in progress may
              not have been saved. Reloading usually resolves this.
            </p>
            <button
              onClick={this.handleReload}
              className="px-6 py-3 bg-gold-500 hover:bg-gold-600 text-white font-sans font-semibold tracking-wide transition-colors"
            >
              Reload Lumina Studio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

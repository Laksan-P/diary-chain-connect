import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
          <div className="glass-card p-10 max-w-md w-full border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Application Error</h2>
            <p className="text-muted-foreground mb-6">
              The application encountered a crash while running in offline mode. We've captured the error and are ready to recover.
            </p>
            <div className="bg-muted/50 p-3 rounded-lg text-left text-xs font-mono mb-6 overflow-x-auto">
              {this.state.error?.message}
            </div>
            <Button 
              className="w-full" 
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
            >
              Restart Application
            </Button>
          </div>
        </div>
      );
    }

    return this.children;
  }
}

export default ErrorBoundary;

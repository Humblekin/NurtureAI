import { Component } from 'react';
import Button from './Button';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--space-12)',
          textAlign: 'center',
          minHeight: '50vh',
        }}>
          <h2 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', maxWidth: 400 }}>
            An unexpected error occurred. Please try refreshing the page.
          </p>
          <Button onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

/**
 * ErrorBoundary — evita la "schermata bianca": se un componente lancia in
 * render, mostra un fallback con possibilità di ricaricare. È anche il punto
 * unico dove agganciare in futuro un crash reporter (es. Sentry).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // TODO: inoltrare a un crash reporter (Sentry) quando configurato.
    console.error('App crashed:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: '24px',
            textAlign: 'center',
            background: '#08070C',
            color: '#F7F3EA',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div style={{ fontSize: '40px' }}>🎬</div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: '14px', color: '#8A8A99', maxWidth: '320px', lineHeight: 1.5, margin: 0 }}>
            The app hit an unexpected error. Reloading usually fixes it.
          </p>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: '8px',
              padding: '12px 24px',
              borderRadius: '14px',
              border: 'none',
              background: '#EDC332',
              color: '#08070C',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

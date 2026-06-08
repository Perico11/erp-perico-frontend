import { Component } from 'react';

/**
 * ErrorBoundary — atrapa errores de React que de otro modo matan toda la app.
 * Muestra un panel amigable con botón de recarga en lugar de pantalla blanca.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '60vh', padding: 32, fontFamily: 'var(--lp-font-sans, system-ui)',
          textAlign: 'center',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--lp-warning-600)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 16 }} aria-hidden="true">
            <path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--lp-text-primary)' }}>
            Algo salió mal
          </h2>
          <p style={{ fontSize: 13, color: 'var(--lp-text-secondary)', maxWidth: 400, marginBottom: 20 }}>
            Hubo un error al cargar esta pantalla. Puede ser por una actualización pendiente.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px', fontSize: 13, fontWeight: 700,
                background: 'var(--lp-brand-600)', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Recargar página
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '10px 24px', fontSize: 13, fontWeight: 600,
                background: 'var(--lp-bg-raised)', color: 'var(--lp-text-primary)', border: '1.5px solid var(--lp-border-subtle)',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ir al inicio
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: 20, fontSize: 11, color: 'var(--lp-text-tertiary)', maxWidth: 500, textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer' }}>Detalle técnico</summary>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: 8 }}>
                {String(this.state.error)}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

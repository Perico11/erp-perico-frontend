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
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: '#1A1815' }}>
            Algo salió mal
          </h2>
          <p style={{ fontSize: 13, color: '#6B6560', maxWidth: 400, marginBottom: 20 }}>
            Hubo un error al cargar esta pantalla. Puede ser por una actualización pendiente.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px', fontSize: 13, fontWeight: 700,
                background: '#7C3AED', color: '#fff', border: 'none',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Recargar página
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                padding: '10px 24px', fontSize: 13, fontWeight: 600,
                background: '#F5F4F2', color: '#1A1815', border: '1.5px solid #E8E6E1',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Ir al inicio
            </button>
          </div>
          {this.state.error && (
            <details style={{ marginTop: 20, fontSize: 11, color: '#999', maxWidth: 500, textAlign: 'left' }}>
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

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturo un error:', error, errorInfo);
  }

  handleReload = () => {
    localStorage.removeItem('trimec_admin_tab');
    localStorage.removeItem('trimec_active_ot');
    localStorage.removeItem('trimec_active_view');
    window.location.href = window.location.origin;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f19',
          color: '#f8fafc',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #ef4444',
            borderRadius: '1rem',
            padding: '2.5rem',
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f87171' }}>
              Se produjo un error al cargar la vista
            </h2>
            <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              Ocurrió una excepción inesperada en el navegador:
            </p>
            <div style={{
              background: '#0f172a',
              padding: '1rem',
              borderRadius: '0.5rem',
              color: '#fca5a5',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              textAlign: 'left',
              overflowX: 'auto',
              marginBottom: '1.5rem',
              border: '1px solid #334155'
            }}>
              {this.state.error?.toString() || 'Error desconocido'}
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: '#334155',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                🔄 Reintentar
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  background: '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                🏠 Ir al Inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

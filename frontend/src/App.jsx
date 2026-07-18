import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardSupervisor from './components/DashboardSupervisor';
import DashboardContador from './components/DashboardContador';
import OtDetail from './components/OtDetail';
import api from './utils/api';

function App() {
  const [user, setUser] = useState(null);
  const [selectedOtId, setSelectedOtId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  useEffect(() => {
    const token = localStorage.getItem('trimec_token');
    const savedUser = localStorage.getItem('trimec_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('trimec_token');
    localStorage.removeItem('trimec_user');
    setUser(null);
    setSelectedOtId(null);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Iniciando portal...</p>
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-container">
      {/* HEADER NAV */}
      <nav className="main-nav">
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => setSelectedOtId(null)}>
          TRIMEC ERP
        </div>
        <div className="nav-user">
          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Conectado como: <strong>{user.nombre}</strong>
          </span>
          <span className={`user-badge ${user.rol}`}>
            {user.rol === 'admin' ? 'Administrador' : user.rol === 'supervisor' ? 'Supervisor' : 'Contador'}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* DASHBOARD OR DETAIL ROUTER */}
      <main style={{ flex: 1 }}>
        {selectedOtId !== null ? (
          <OtDetail
            otId={selectedOtId}
            onBack={() => setSelectedOtId(null)}
            userRole={user.rol}
            showToast={showToast}
          />
        ) : (
          <>
            {user.rol === 'admin' && (
              <DashboardAdmin onSelectOt={setSelectedOtId} showToast={showToast} />
            )}
            {user.rol === 'supervisor' && (
              <DashboardSupervisor onSelectOt={setSelectedOtId} showToast={showToast} />
            )}
            {user.rol === 'contador' && (
              <DashboardContador onSelectOt={setSelectedOtId} showToast={showToast} />
            )}
          </>
        )}
      </main>

      {/* FLOATING TOAST */}
      {toast && (
        <div className={`toast-notification toast-${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' ? '✓' : toast.type === 'danger' ? '✕' : 'ℹ'}
          </div>
          <div className="toast-message">{toast.message}</div>
        </div>
      )}
    </div>
  );
}

export default App;

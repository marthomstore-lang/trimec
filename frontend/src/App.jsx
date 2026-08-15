import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import DashboardAdmin from './components/DashboardAdmin';
import DashboardSupervisor from './components/DashboardSupervisor';
import DashboardContador from './components/DashboardContador';
import DashboardOperador from './components/DashboardOperador';
import OtDetail from './components/OtDetail';
import ModuloTerrenoOffline from './components/ModuloTerrenoOffline';
import api from './utils/api';

function App() {
  const [user, setUser] = useState(null);
  const [selectedOtId, setSelectedOtId] = useState(null);
  const [showModuloTerreno, setShowModuloTerreno] = useState(false);
  const [terrenoOtId, setTerrenoOtId] = useState('');
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

    // Detectar si se abrió enlace compartido de terreno (?ot=SER-545&terreno=true)
    const params = new URLSearchParams(window.location.search);
    const otParam = params.get('ot') || params.get('terreno_ot');
    const isTerreno = params.get('terreno') === 'true' || !!params.get('terreno_ot');
    if (otParam && isTerreno) {
      setTerrenoOtId(otParam);
      setShowModuloTerreno(true);
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
    setShowModuloTerreno(false);
    setTerrenoOtId('');
  };

  const handleOpenTerrenoForOt = (otId) => {
    setTerrenoOtId(otId);
    setSelectedOtId(null);
    setShowModuloTerreno(true);
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
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => { setSelectedOtId(null); setShowModuloTerreno(false); setTerrenoOtId(''); }}>
          TRIMEC ERP
        </div>
        <div className="nav-user">
          <button 
            className="btn btn-primary btn-sm" 
            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} 
            onClick={() => { setSelectedOtId(null); setShowModuloTerreno(!showModuloTerreno); setTerrenoOtId(''); }}
          >
            {showModuloTerreno ? '📊 Ver Dashboard' : '📱 Terreno (Offline & Km)'}
          </button>
          <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
            Conectado como: <strong>{user.nombre}</strong>
          </span>
          <span className={`user-badge ${user.rol}`}>
            {user.rol === 'admin' ? 'Administrador' : user.rol === 'supervisor' ? 'Supervisor' : user.rol === 'contador' ? 'Contador' : 'Operador'}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* DASHBOARD OR DETAIL ROUTER */}
      <main style={{ flex: 1, padding: '1.5rem 1rem' }}>
        {showModuloTerreno ? (
          <ModuloTerrenoOffline 
            initialOtId={terrenoOtId}
            onBack={() => { setShowModuloTerreno(false); setTerrenoOtId(''); }} 
            showToast={showToast} 
          />
        ) : selectedOtId !== null ? (
          <OtDetail
            otId={selectedOtId}
            onBack={() => setSelectedOtId(null)}
            onOpenTerreno={handleOpenTerrenoForOt}
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
            {user.rol === 'operador' && (
              <DashboardOperador showToast={showToast} />
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

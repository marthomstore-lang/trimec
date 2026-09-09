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

  // Inicializar estados persistentes leyendo la URL o localStorage
  const [selectedOtId, setSelectedOtId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const otParam = params.get('ot');
    const isTerreno = params.get('terreno') === 'true' || !!params.get('terreno_ot');
    if (otParam && !isTerreno) return otParam;
    return localStorage.getItem('trimec_active_ot') || null;
  });

  const [showModuloTerreno, setShowModuloTerreno] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const isTerreno = params.get('terreno') === 'true' || !!params.get('terreno_ot');
    if (isTerreno) return true;
    return localStorage.getItem('trimec_active_view') === 'terreno';
  });

  const [terrenoOtId, setTerrenoOtId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('terreno_ot') || (params.get('terreno') === 'true' ? params.get('ot') : '') || '';
  });

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Sincronizar URL inicial y escuchar navegación atrás/adelante del navegador
  useEffect(() => {
    const token = localStorage.getItem('trimec_token');
    const savedUser = localStorage.getItem('trimec_user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }

    // Asegurar que la URL refleje el estado inicial restaurado
    const params = new URLSearchParams(window.location.search);
    if (selectedOtId && !params.get('ot')) {
      params.set('ot', selectedOtId);
      window.history.replaceState({ otId: selectedOtId }, '', `${window.location.pathname}?${params.toString()}`);
    } else if (showModuloTerreno && !params.get('terreno')) {
      params.set('terreno', 'true');
      if (terrenoOtId) params.set('terreno_ot', terrenoOtId);
      window.history.replaceState({ view: 'terreno' }, '', `${window.location.pathname}?${params.toString()}`);
    }

    const handlePopState = () => {
      const currentParams = new URLSearchParams(window.location.search);
      const otParam = currentParams.get('ot');
      const isTerreno = currentParams.get('terreno') === 'true' || !!currentParams.get('terreno_ot');

      if (isTerreno) {
        setShowModuloTerreno(true);
        setSelectedOtId(null);
        setTerrenoOtId(currentParams.get('terreno_ot') || currentParams.get('ot') || '');
      } else if (otParam) {
        setSelectedOtId(otParam);
        setShowModuloTerreno(false);
        setTerrenoOtId('');
      } else {
        setSelectedOtId(null);
        setShowModuloTerreno(false);
        setTerrenoOtId('');
      }
    };

    window.addEventListener('popstate', handlePopState);
    setLoading(false);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectOt = (otId) => {
    setSelectedOtId(otId);
    setShowModuloTerreno(false);
    setTerrenoOtId('');
    
    const params = new URLSearchParams(window.location.search);
    if (otId) {
      localStorage.setItem('trimec_active_ot', otId);
      localStorage.removeItem('trimec_active_view');
      params.set('ot', otId);
      params.delete('terreno');
      params.delete('terreno_ot');
      window.history.pushState({ otId }, '', `${window.location.pathname}?${params.toString()}`);
    } else {
      localStorage.removeItem('trimec_active_ot');
      params.delete('ot');
      const search = params.toString();
      window.history.pushState({}, '', search ? `${window.location.pathname}?${search}` : window.location.pathname);
    }
  };

  const handleToggleTerreno = () => {
    const nextState = !showModuloTerreno;
    setShowModuloTerreno(nextState);
    setSelectedOtId(null);
    setTerrenoOtId('');

    const params = new URLSearchParams(window.location.search);
    params.delete('ot');

    if (nextState) {
      localStorage.removeItem('trimec_active_ot');
      localStorage.setItem('trimec_active_view', 'terreno');
      params.set('terreno', 'true');
      window.history.pushState({ view: 'terreno' }, '', `${window.location.pathname}?${params.toString()}`);
    } else {
      localStorage.removeItem('trimec_active_view');
      params.delete('terreno');
      params.delete('terreno_ot');
      const search = params.toString();
      window.history.pushState({}, '', search ? `${window.location.pathname}?${search}` : window.location.pathname);
    }
  };

  const handleLoginSuccess = (loggedInUser) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('trimec_token');
    localStorage.removeItem('trimec_user');
    localStorage.removeItem('trimec_active_ot');
    localStorage.removeItem('trimec_active_view');
    localStorage.removeItem('trimec_admin_tab');
    setUser(null);
    setSelectedOtId(null);
    setShowModuloTerreno(false);
    setTerrenoOtId('');
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleOpenTerrenoForOt = (otId) => {
    setTerrenoOtId(otId);
    setSelectedOtId(null);
    setShowModuloTerreno(true);
    localStorage.removeItem('trimec_active_ot');
    localStorage.setItem('trimec_active_view', 'terreno');

    const params = new URLSearchParams(window.location.search);
    params.delete('ot');
    params.set('terreno', 'true');
    params.set('terreno_ot', otId);
    window.history.pushState({ view: 'terreno', otId }, '', `${window.location.pathname}?${params.toString()}`);
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
        <div className="nav-brand" style={{ cursor: 'pointer' }} onClick={() => handleSelectOt(null)}>
          TRIMEC ERP
        </div>
        <div className="nav-user">
          <button 
            className="btn btn-primary btn-sm" 
            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7', padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} 
            onClick={handleToggleTerreno}
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
            onBack={() => handleToggleTerreno()} 
            showToast={showToast} 
          />
        ) : selectedOtId !== null ? (
          <OtDetail
            otId={selectedOtId}
            onBack={() => handleSelectOt(null)}
            onOpenTerreno={handleOpenTerrenoForOt}
            userRole={user.rol}
            showToast={showToast}
          />
        ) : (
          <>
            {user.rol === 'admin' && (
              <DashboardAdmin onSelectOt={handleSelectOt} showToast={showToast} />
            )}
            {user.rol === 'supervisor' && (
              <DashboardSupervisor onSelectOt={handleSelectOt} showToast={showToast} />
            )}
            {user.rol === 'contador' && (
              <DashboardContador onSelectOt={handleSelectOt} showToast={showToast} />
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

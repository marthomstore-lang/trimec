import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import FichaTecnicaIntervencion from './FichaTecnicaIntervencion';

const DashboardOperador = ({ initialOtId = '', showToast }) => {
  const [ots, setOts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState(() => {
    return localStorage.getItem('trimec_operador_trabajador_id') || '';
  });
  const [selectedOtId, setSelectedOtId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return initialOtId || params.get('ot') || params.get('terreno_ot') || localStorage.getItem('trimec_operador_ot') || '';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialOtId) {
      setSelectedOtId(String(initialOtId));
    }
  }, [initialOtId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [allOts, workersData] = await Promise.all([
        api('/ots'),
        api('/trabajadores').catch(() => [])
      ]);
      const activeOts = (Array.isArray(allOts) ? allOts : []).filter(
        o => !['Facturada', 'FAC', 'Cerrada', 'CER', 'Anulada'].includes(o.estado)
      );
      setOts(activeOts);
      setWorkers(Array.isArray(workersData) ? workersData : []);
    } catch (err) {
      setError('Error al cargar las Órdenes de Trabajo: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    document.title = 'Trimec - Portal Técnico';
  }, []);

  const handleSelectWorker = (workerId) => {
    const strId = workerId ? String(workerId) : '';
    setSelectedWorkerId(strId);
    if (strId) {
      localStorage.setItem('trimec_operador_trabajador_id', strId);
    } else {
      localStorage.removeItem('trimec_operador_trabajador_id');
    }
  };

  const handleChooseOt = (id) => {
    const strId = id ? String(id) : '';
    setSelectedOtId(strId);
    const params = new URLSearchParams(window.location.search);
    if (strId) {
      localStorage.setItem('trimec_operador_ot', strId);
      params.set('ot', strId);
      params.delete('terreno');
      params.delete('terreno_ot');
      window.history.replaceState({ otId: strId }, '', `${window.location.pathname}?${params.toString()}`);
    } else {
      localStorage.removeItem('trimec_operador_ot');
      localStorage.removeItem('trimec_active_ot');
      params.delete('ot');
      params.delete('terreno');
      params.delete('terreno_ot');
      const search = params.toString();
      window.history.replaceState({}, '', search ? `${window.location.pathname}?${search}` : window.location.pathname);
    }
  };

  if (loading) {
    return (
      <div className="card text-center p-5" style={{ maxWidth: '900px', margin: '2rem auto' }}>
        <p>Cargando Órdenes de Trabajo activas...</p>
      </div>
    );
  }

  const selectedOt = ots.find(o => String(o.id) === String(selectedOtId));
  const activeWorker = workers.find(w => String(w.id) === String(selectedWorkerId));

  const filteredOts = ots.filter(o => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return true;
    return (
      String(o.id).toLowerCase().includes(q) ||
      (o.cliente_nombre || o.cliente || '').toLowerCase().includes(q) ||
      (o.detalle || '').toLowerCase().includes(q) ||
      (o.faena || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="container-fluid py-3" style={{ maxWidth: '1050px', margin: '0 auto' }}>
      {error && <div className="alert alert-danger mb-3">{error}</div>}

      {/* BARRA FIJA SUPERIOR: SELECCIÓN DE NOMBRE DEL OPERARIO (SIN MOSTRAR VALORES NI COSTOS) */}
      <div
        className="panel-card"
        style={{
          padding: '0.9rem 1.2rem',
          marginBottom: '1.25rem',
          borderLeft: selectedWorkerId ? '4px solid #10b981' : '4px solid #f59e0b',
          background: selectedWorkerId
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.95))'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.14), rgba(15, 23, 42, 0.95))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem'
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: selectedWorkerId ? '#34d399' : '#fbbf24' }}>
            👷 {activeWorker ? `Operario activo: ${activeWorker.nombre} (${activeWorker.rol})` : 'Paso 1: Selecciona tu Nombre de Operario / Técnico'}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
            Tu selección queda guardada en este teléfono para registrar tus horas trabajadas (HH) del día en cada OT.
          </div>
        </div>
        <div style={{ minWidth: '250px', flex: '0 1 320px' }}>
          <select
            className="form-input"
            style={{ fontWeight: 600, borderColor: selectedWorkerId ? '#10b981' : '#f59e0b' }}
            value={selectedWorkerId}
            onChange={e => handleSelectWorker(e.target.value)}
          >
            <option value="">-- Seleccionar mi nombre --</option>
            {workers.map(w => (
              <option key={w.id} value={w.id}>
                {w.nombre} — {w.rol}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* VISTA 1: SI NO HA SELECCIONADO OT, MOSTRAR EL LISTADO DE OTs ACTIVAS */}
      {!selectedOt ? (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 700 }}>
                🛠️ Órdenes de Trabajo Activas
              </h2>
              <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Selecciona una Orden de Trabajo (OT) para completar la Ficha de Mantención e ingresar tus horas trabajadas del día.
              </p>
            </div>

            <div style={{ minWidth: '260px', flex: '0 1 340px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="🔍 Buscar por N° OT, Cliente, Faena o Equipo..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredOts.length === 0 ? (
            <div className="panel-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                No se encontraron Órdenes de Trabajo activas.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: '1rem'
            }}>
              {filteredOts.map(ot => (
                <div
                  key={ot.id}
                  onClick={() => handleChooseOt(ot.id)}
                  className="panel-card"
                  style={{
                    cursor: 'pointer',
                    padding: '1.25rem',
                    borderLeft: ot.es_emergencia === 1 ? '4px solid #ef4444' : '4px solid #3b82f6',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '0.85rem'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#60a5fa' }}>
                        OT #{ot.id}
                      </span>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        {ot.es_emergencia === 1 && (
                          <span className="badge badge-sp" style={{ fontSize: '0.7rem' }}>⚡ EMERGENCIA</span>
                        )}
                        <span className="badge badge-proceso" style={{ fontSize: '0.75rem' }}>
                          {ot.estado || 'Activa'}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                      🏢 {ot.cliente_nombre || ot.cliente || 'Cliente Trimec'}
                    </div>

                    {ot.faena && (
                      <div style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.4rem', fontWeight: 600 }}>
                        📍 {ot.faena}
                      </div>
                    )}

                    <p style={{
                      margin: 0,
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.4,
                      background: 'rgba(255,255,255,0.03)',
                      padding: '0.6rem',
                      borderRadius: '6px'
                    }}>
                      {ot.detalle || 'Sin descripción detallada'}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', fontWeight: 600, padding: '0.55rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChooseOt(ot.id);
                    }}
                  >
                    🛠️ Ingresar Datos y Horas del Día →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VISTA 2: OT SELECCIONADA -> SOLO SE VE LA OT Y LAS OPCIONES DE LA FICHA + HORAS DEL DÍA */
        <div>
          <div className="panel-card" style={{
            padding: '1.25rem',
            marginBottom: '1.25rem',
            borderLeft: '4px solid #3b82f6',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#60a5fa' }}>
                    Orden de Trabajo: OT #{selectedOt.id}
                  </span>
                  <span className="badge badge-proceso">{selectedOt.estado}</span>
                  {selectedOt.es_emergencia === 1 && <span className="badge badge-sp">⚡ EMERGENCIA</span>}
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.95rem', fontWeight: 600, color: '#e2e8f0' }}>
                  🏢 Cliente: {selectedOt.cliente_nombre || selectedOt.cliente}
                  {selectedOt.faena ? ` — 📍 ${selectedOt.faena}` : ''}
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  <strong>Trabajo Solicitado:</strong> "{selectedOt.detalle}"
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <select
                  className="form-input"
                  style={{ width: 'auto', minWidth: '210px', fontSize: '0.85rem' }}
                  value={selectedOt.id}
                  onChange={e => handleChooseOt(e.target.value)}
                >
                  {ots.map(o => (
                    <option key={o.id} value={o.id}>
                      Cambiar a OT #{o.id} — {o.cliente_nombre || o.cliente}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleChooseOt('')}
                >
                  ← Ver Todas las OTs
                </button>
              </div>
            </div>
          </div>

          <FichaTecnicaIntervencion
            fixedOtId={selectedOt.id}
            otsList={ots}
            personalList={workers}
            defaultWorkerId={selectedWorkerId}
            onWorkerChange={handleSelectWorker}
            showToast={showToast}
            onSaved={() => fetchData()}
          />
        </div>
      )}
    </div>
  );
};

export default DashboardOperador;

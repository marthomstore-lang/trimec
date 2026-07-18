import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const DashboardAdmin = ({ onSelectOt, showToast }) => {
  const [ots, setOts] = useState([]);
  const [clients, setClients] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals / Form states
  const [showClientModal, setShowClientModal] = useState(false);
  const [showOtModal, setShowOtModal] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);

  // Form inputs
  const [newClient, setNewClient] = useState({ rut: '', razon_social: '', prefijo: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '' });
  const [selectedClientIdToEdit, setSelectedClientIdToEdit] = useState('');
  const [newOt, setNewOt] = useState({ id: '', cliente_id: '', detalle: '', estado: 'SP', es_emergencia: false, recargo_emergencia: 0, monto_neto_presupuesto: 0, hh_presupuestadas: 0, fecha_solicitud: new Date().toISOString().split('T')[0], fecha_aprobacion: '', fecha_entrega: '' });

  const generatePrefixSuggestion = (name) => {
    if (!name) return '';
    const clean = name.toUpperCase()
      .replace(/\b(S\.A\.|SPA|LTDA|DE|EL|LA|LOS|LAS|Y|E|LIMITADA|E\.I\.R\.L\.)\b/gi, '')
      .replace(/[^A-Z0-9\s]/g, '')
      .trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) {
      return words[0].substring(0, 3).padEnd(3, 'X');
    } else {
      const first = words[0][0] || '';
      const second = words[1].substring(0, 2) || '';
      return (first + second).substring(0, 3);
    }
  };

  const handleRazonSocialChange = (val) => {
    const suggested = selectedClientIdToEdit === '' ? generatePrefixSuggestion(val) : newClient.prefijo;
    setNewClient({ ...newClient, razon_social: val, prefijo: suggested });
  };
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTabAdmin, setActiveTabAdmin] = useState('ots'); // 'ots', 'rendimiento'
  const [performanceData, setPerformanceData] = useState([]);

  const fetchPerformance = async () => {
    try {
      const data = await api('/finanzas/rendimiento-personal');
      setPerformanceData(data);
    } catch (err) {
      showToast('Error al cargar rendimiento de personal', 'danger');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [otsData, clientsData, workersData] = await Promise.all([
        api('/ots'),
        api('/clientes'),
        api('/trabajadores')
      ]);
      setOts(otsData);
      setClients(clientsData);
      setWorkers(workersData);
    } catch (err) {
      setError(err.message || 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTabAdmin === 'ots') {
      document.title = 'Trimec - Gestión de OTs y Tarifas';
    } else {
      document.title = 'Trimec - Rendimiento de Personal';
    }
  }, [activeTabAdmin]);

  const handleClientSelectChange = (clientId) => {
    setSelectedClientIdToEdit(clientId);
    if (clientId === '') {
      setNewClient({ rut: '', razon_social: '', prefijo: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '' });
    } else {
      const selected = clients.find(c => c.id === parseInt(clientId));
      if (selected) {
        setNewClient({
          rut: selected.rut || '',
          razon_social: selected.razon_social || '',
          prefijo: selected.prefijo || '',
          contacto_nombre: selected.contacto_nombre || '',
          contacto_email: selected.contacto_email || '',
          contacto_telefono: selected.contacto_telefono || ''
        });
      }
    }
  };

  const handleSaveClient = async (e) => {
    e.preventDefault();
    try {
      if (selectedClientIdToEdit === '') {
        await api('/clientes', {
          method: 'POST',
          body: JSON.stringify(newClient),
        });
        showToast('Cliente creado con éxito', 'success');
      } else {
        await api(`/clientes/${selectedClientIdToEdit}`, {
          method: 'PUT',
          body: JSON.stringify(newClient),
        });
        showToast('Cliente actualizado con éxito', 'success');
      }
      setShowClientModal(false);
      setSelectedClientIdToEdit('');
      setNewClient({ rut: '', razon_social: '', prefijo: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '' });
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleCreateOt = async (e) => {
    e.preventDefault();
    if (!newOt.id) {
      showToast('Debes ingresar un número de OT válido', 'warning');
      return;
    }
    try {
      await api('/ots', {
        method: 'POST',
        body: JSON.stringify({
          ...newOt,
          cliente_id: parseInt(newOt.cliente_id),
          monto_neto_presupuesto: parseFloat(newOt.monto_neto_presupuesto),
          hh_presupuestadas: parseFloat(newOt.hh_presupuestadas || 0)
        }),
      });
      showToast('Orden de Trabajo abierta con éxito', 'success');
      setShowOtModal(false);
      setNewOt({ id: '', cliente_id: '', detalle: '', estado: 'SP', es_emergencia: false, recargo_emergencia: 0, monto_neto_presupuesto: 0, hh_presupuestadas: 0, fecha_solicitud: new Date().toISOString().split('T')[0], fecha_aprobacion: '', fecha_entrega: '' });
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleOtClientChange = async (clientId) => {
    if (!clientId) {
      setNewOt({ ...newOt, cliente_id: '', id: '' });
      return;
    }
    const selected = clients.find(c => c.id === parseInt(clientId));
    if (selected) {
      try {
        const { siguiente_numero } = await api('/ots/siguiente-numero');
        const prefijo = selected.prefijo || 'OT';
        setNewOt({ ...newOt, cliente_id: clientId, id: `${prefijo}-${siguiente_numero}` });
      } catch (err) {
        showToast('Error al obtener correlativo de OT', 'danger');
        setNewOt({ ...newOt, cliente_id: clientId, id: `${selected.prefijo || 'OT'}-` });
      }
    }
  };

  const handleSaveWorker = async (e) => {
    e.preventDefault();
    try {
      if (!selectedWorker.id) {
        await api('/trabajadores', {
          method: 'POST',
          body: JSON.stringify(selectedWorker),
        });
        showToast('Trabajador agregado con éxito', 'success');
      } else {
        await api(`/trabajadores/${selectedWorker.id}`, {
          method: 'PUT',
          body: JSON.stringify(selectedWorker),
        });
        showToast('Datos de trabajador actualizados con éxito', 'success');
      }
      setShowWorkerModal(false);
      setSelectedWorker(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDeleteWorker = async (workerId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar a esta persona? Esto no borrará sus registros de HH históricos pero no aparecerá más en los listados activos.')) {
      return;
    }
    try {
      await api(`/trabajadores/${workerId}`, {
        method: 'DELETE',
      });
      showToast('Trabajador eliminado con éxito', 'success');
      setShowWorkerModal(false);
      setSelectedWorker(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // KPIs
  const totalRevenue = ots.reduce((acc, curr) => acc + (curr.monto_neto_presupuesto || 0), 0);
  const totalCost = ots.reduce((acc, curr) => acc + (curr.costo_total || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const filteredOts = ots.filter(ot => 
    ot.id.toString().includes(searchQuery) ||
    ot.cliente_nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ot.detalle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-container">
      <div className="dashboard-title-bar">
        <div>
          <h2>Panel de Administración (Angelo Muñoz V.)</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Control de producción, presupuestos y costos en tiempo real</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowClientModal(true)}>+ Gestionar Clientes</button>
          <button className="btn btn-primary" onClick={() => setShowOtModal(true)}>+ Abrir OT / SP</button>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card cyan">
          <div className="kpi-label">Ingresos Proyectados (Neto)</div>
          <div className="kpi-value">${Math.round(totalRevenue).toLocaleString('es-CL')}</div>
        </div>
        <div className="kpi-card warning">
          <div className="kpi-label">Costo Total Acumulado (HH + Gastos)</div>
          <div className="kpi-value">${Math.round(totalCost).toLocaleString('es-CL')}</div>
        </div>
        <div className="kpi-card success">
          <div className="kpi-label">Margen Operativo Bruto</div>
          <div className="kpi-value" style={{ color: totalProfit >= 0 ? '#34d399' : '#f87171' }}>
            ${Math.round(totalProfit).toLocaleString('es-CL')}
          </div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-label">Margen Porcentual Promedio</div>
          <div className="kpi-value" style={{ color: avgMargin >= 25 ? '#34d399' : avgMargin >= 0 ? '#fbbf24' : '#f87171' }}>
            {avgMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
        <button className={`tab-btn ${activeTabAdmin === 'ots' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('ots')}>
          📋 Órdenes de Trabajo y Tarifas
        </button>
        <button className={`tab-btn ${activeTabAdmin === 'rendimiento' ? 'active' : ''}`} onClick={() => { setActiveTabAdmin('rendimiento'); fetchPerformance(); }}>
          📊 Rendimiento y Eficiencia de Personal (Mensual)
        </button>
      </div>

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando datos del sistema...</p>
      ) : (
        <div>
          {/* TAB 1: OTS Y TARIFAS */}
          {activeTabAdmin === 'ots' && (
            <div className="dashboard-layout">
          {/* Main OTs List */}
          <div className="panel-card">
            <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h3>Listado General de Órdenes de Trabajo (OT)</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total: {filteredOts.length} registros</span>
              </div>
            </div>

            <div className="search-container">
              <span className="search-icon-placeholder">🔍</span>
              <input 
                type="text" 
                className="search-control" 
                placeholder="Buscar OT por número, cliente o descripción..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nro OT</th>
                    <th>Cliente</th>
                    <th>Detalle</th>
                    <th>Estado</th>
                    <th>Neto Presupuestado</th>
                    <th>Costo Real</th>
                    <th>Margen</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOts.map((ot) => (
                    <tr key={ot.id}>
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{ot.id}</td>
                      <td style={{ fontWeight: 500 }}>{ot.cliente_nombre}</td>
                      <td style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ot.es_emergencia === 1 && <span style={{ color: '#ef4444', fontWeight: 'bold', marginRight: '4px' }}>[URGENTE]</span>}
                        {ot.detalle}
                      </td>
                      <td>
                        <span className={`badge badge-${ot.estado.toLowerCase().replace(' ', '')}`}>
                          {ot.estado}
                        </span>
                      </td>
                      <td className="text-right">${Math.round(ot.monto_neto_presupuesto).toLocaleString('es-CL')}</td>
                      <td className="text-right">${Math.round(ot.costo_total).toLocaleString('es-CL')}</td>
                      <td className="text-right">
                        <span className={`margin-pill ${ot.margen_monto >= 0 ? 'margin-positive' : 'margin-negative'}`}>
                          {ot.margen_porcentaje.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={() => onSelectOt(ot.id)}>
                          🔍 Gestionar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {ots.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        No hay Órdenes de Trabajo registradas. ¡Abre una nueva para comenzar!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Worker wages & details */}
          <div className="panel-card">
            <div className="panel-header">
              <h3>Tarifario de HH y Remuneraciones</h3>
              <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => { setSelectedWorker({ nombre: '', rol: '', sueldo_base: 0, valor_hh_normal: 0, valor_hh_extra: 0, horas_mensuales_esperadas: 180 }); setShowWorkerModal(true); }}>
                + Agregar
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Valores por hora utilizados para el costeo automático en base al rol de cada trabajador.
            </p>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Valor HH</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {workers.map((w) => (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 600 }}>
                        {w.nombre}
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>{w.rol}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem' }}>Normal: <strong>${Math.round(w.valor_hh_normal).toLocaleString('es-CL')}</strong></div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Extra: ${Math.round(w.valor_hh_extra).toLocaleString('es-CL')}</div>
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => { setSelectedWorker(w); setShowWorkerModal(true); }}>
                          ⚙️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
            </div>
          )}

          {/* TAB 2: RENDIMIENTO Y EFICIENCIA DE PERSONAL */}
          {activeTabAdmin === 'rendimiento' && (
            <div className="panel-card">
              <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <h3>Rendimiento Mensual de Personal (Horas Hombre)</h3>
                  <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem' }}>Meta de horas a cumplir respecto a las horas reales imputadas durante el mes actual.</p>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {performanceData.map((perf) => {
                  const progressVal = perf.horas_mensuales_esperadas > 0 ? (perf.horas_reales / perf.horas_mensuales_esperadas) * 100 : 0;
                  const barColor = progressVal >= 70 ? '#10b981' : progressVal >= 30 ? '#f59e0b' : '#ef4444';
                  return (
                    <div key={perf.id} style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--panel-border)', padding: '1.25rem', borderRadius: '1.15rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{perf.nombre}</h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{perf.rol}</span>
                        </div>
                        <span className="badge badge-proceso" style={{ fontSize: '0.8rem' }}>{Math.round(progressVal)}% cumplido</span>
                      </div>

                      {/* Progress bar */}
                      <div style={{ background: 'rgba(255,255,255,0.05)', height: '10px', borderRadius: '99px', overflow: 'hidden', marginBottom: '0.75rem' }}>
                        <div style={{ width: `${Math.min(progressVal, 100)}%`, background: barColor, height: '100%' }}></div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        <span>Horas Imputadas: <strong>{perf.horas_reales} hrs</strong></span>
                        <span>Meta Mensual: {perf.horas_mensuales_esperadas} hrs</span>
                      </div>

                      {/* OT breakdown list */}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                        <h5 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>Distribución por OT:</h5>
                        {perf.desglose.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            {perf.desglose.map(otBreak => (
                              <div key={otBreak.ot_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', background: 'rgba(255,255,255,0.01)', padding: '0.35rem 0.5rem', borderRadius: '0.375rem' }}>
                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>OT {otBreak.ot_id}</span>
                                <span style={{ color: 'var(--text-secondary)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={otBreak.ot_detalle}>{otBreak.ot_detalle}</span>
                                <strong style={{ color: 'var(--text-primary)' }}>{otBreak.horas_ot} hrs</strong>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>Sin horas registradas en este período.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: GESTIONAR CLIENTES */}
      {showClientModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{selectedClientIdToEdit === '' ? 'Crear Nuevo Cliente' : 'Editar Cliente'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowClientModal(false); setSelectedClientIdToEdit(''); setNewClient({ rut: '', razon_social: '', prefijo: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '' }); }}>Cerrar</button>
            </div>
            
            <div className="form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 600 }}>Seleccionar Cliente Registrado para Editar</label>
              <select className="form-control mt-2" value={selectedClientIdToEdit} onChange={(e) => handleClientSelectChange(e.target.value)}>
                <option value="">-- [ Nuevo Cliente ] --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social} ({c.rut})</option>)}
              </select>
            </div>

            <form onSubmit={handleSaveClient}>
              <div className="form-group">
                <label>RUT Cliente</label>
                <input type="text" className="form-control" placeholder="12.345.678-9" value={newClient.rut} onChange={(e) => setNewClient({ ...newClient, rut: e.target.value })} required />
              </div>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Razón Social</label>
                  <input type="text" className="form-control" placeholder="Empresa S.A." value={newClient.razon_social} onChange={(e) => handleRazonSocialChange(e.target.value)} required />
                </div>
                <div className="form-group" style={{ width: '130px' }}>
                  <label>Prefijo (3 letras)</label>
                  <input type="text" className="form-control" placeholder="Ej: MHE" maxLength="3" value={newClient.prefijo} onChange={(e) => setNewClient({ ...newClient, prefijo: e.target.value.toUpperCase().slice(0,3) })} required />
                </div>
              </div>
              <div className="form-group">
                <label>Nombre Contacto</label>
                <input type="text" className="form-control" placeholder="Juan Pérez" value={newClient.contacto_nombre} onChange={(e) => setNewClient({ ...newClient, contacto_nombre: e.target.value })} />
              </div>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Email Contacto</label>
                  <input type="email" className="form-control" placeholder="contacto@empresa.com" value={newClient.contacto_email} onChange={(e) => setNewClient({ ...newClient, contacto_email: e.target.value })} />
                </div>
                <div className="form-group flex-grow">
                  <label>Teléfono</label>
                  <input type="text" className="form-control" placeholder="+56 9..." value={newClient.contacto_telefono} onChange={(e) => setNewClient({ ...newClient, contacto_telefono: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                {selectedClientIdToEdit === '' ? 'Crear Cliente' : 'Actualizar Cliente'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA OT / SP */}
      {showOtModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Abrir Nueva Orden de Trabajo / SP</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowOtModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleCreateOt}>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Cliente</label>
                  <select className="form-control" value={newOt.cliente_id} onChange={(e) => handleOtClientChange(e.target.value)} required>
                    <option value="">-- Seleccionar --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                  </select>
                </div>
                <div className="form-group flex-grow">
                  <label>Número de OT (Autogenerado)</label>
                  <input type="text" className="form-control" placeholder="Ej: SER-545" value={newOt.id} onChange={(e) => setNewOt({ ...newOt, id: e.target.value })} required />
                </div>
              </div>

              <div className="form-group">
                <label>Detalle de la Actividad / Trabajo</label>
                <textarea className="form-control" rows="3" placeholder="Ej: Confección de tolva de recepción y soldadura..." value={newOt.detalle} onChange={(e) => setNewOt({ ...newOt, detalle: e.target.value })} required></textarea>
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Fecha de Solicitud</label>
                  <input type="date" className="form-control" value={newOt.fecha_solicitud} onChange={(e) => setNewOt({ ...newOt, fecha_solicitud: e.target.value })} />
                </div>
                <div className="form-group flex-grow">
                  <label>Monto Neto Presupuestado ($)</label>
                  <input type="number" className="form-control" placeholder="1200000" value={newOt.monto_neto_presupuesto} onChange={(e) => setNewOt({ ...newOt, monto_neto_presupuesto: e.target.value })} />
                </div>
                <div className="form-group flex-grow">
                  <label>HH Presupuestadas (Hrs)</label>
                  <input type="number" className="form-control" placeholder="Ej: 150" value={newOt.hh_presupuestadas} onChange={(e) => setNewOt({ ...newOt, hh_presupuestadas: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '2rem', padding: '0.75rem 0', alignItems: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', marginBottom: '1rem', paddingLeft: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                  <input type="checkbox" checked={newOt.es_emergencia} onChange={(e) => setNewOt({ ...newOt, es_emergencia: e.target.checked })} />
                  ¿Es trabajo de EMERGENCIA?
                </label>
                {newOt.es_emergencia && (
                  <div className="flex-grow" style={{ paddingRight: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>% Recargo Emergencia</label>
                    <input type="number" className="form-control mt-2" placeholder="Ej: 50" value={newOt.recargo_emergencia} onChange={(e) => setNewOt({ ...newOt, recargo_emergencia: parseFloat(e.target.value) || 0 })} />
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Abrir Registro</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GESTIONAR PERSONAL */}
      {showWorkerModal && selectedWorker && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{selectedWorker.id ? `Editar Personal: ${selectedWorker.nombre}` : 'Agregar Nueva Persona'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowWorkerModal(false); setSelectedWorker(null); }}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveWorker}>
              <div className="form-group">
                <label>Nombre Completo</label>
                <input type="text" className="form-control" placeholder="Ej: Alvaro" value={selectedWorker.nombre || ''} onChange={(e) => setSelectedWorker({ ...selectedWorker, nombre: e.target.value })} required />
              </div>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Cargo / Rol</label>
                  <input type="text" className="form-control" placeholder="Ej: Soldador MIG" value={selectedWorker.rol || ''} onChange={(e) => setSelectedWorker({ ...selectedWorker, rol: e.target.value })} required />
                </div>
                <div className="form-group flex-grow">
                  <label>Horas Mensuales Esperadas</label>
                  <input type="number" className="form-control" placeholder="Ej: 180" value={selectedWorker.horas_mensuales_esperadas || ''} onChange={(e) => setSelectedWorker({ ...selectedWorker, horas_mensuales_esperadas: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="form-group">
                <label>Sueldo Base ($)</label>
                <input type="number" className="form-control" placeholder="Ej: 800000" value={selectedWorker.sueldo_base || 0} onChange={(e) => setSelectedWorker({ ...selectedWorker, sueldo_base: parseFloat(e.target.value) })} />
              </div>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Valor HH Normal ($)</label>
                  <input type="number" className="form-control" placeholder="Ej: 5000" value={selectedWorker.valor_hh_normal || ''} onChange={(e) => setSelectedWorker({ ...selectedWorker, valor_hh_normal: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div className="form-group flex-grow">
                  <label>Valor HH Extra ($)</label>
                  <input type="number" className="form-control" placeholder="Ej: 7500" value={selectedWorker.valor_hh_extra || ''} onChange={(e) => setSelectedWorker({ ...selectedWorker, valor_hh_extra: parseFloat(e.target.value) || 0 })} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                {selectedWorker.id ? 'Guardar Cambios' : 'Agregar Persona'}
              </button>
              {selectedWorker.id && (
                <button type="button" className="btn btn-danger" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => handleDeleteWorker(selectedWorker.id)}>
                  🗑️ Eliminar de la Planilla
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardAdmin;

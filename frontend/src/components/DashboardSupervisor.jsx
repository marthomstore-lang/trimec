import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const DashboardSupervisor = ({ onSelectOt, showToast }) => {
  const [ots, setOts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('ots'); // 'ots', 'hh', 'gastos'
  const [searchQuery, setSearchQuery] = useState('');

  // Lists for logs
  const [hhRecords, setHhRecords] = useState([]);
  const [expenseRecords, setExpenseRecords] = useState([]);

  // Form States
  const [newHh, setNewHh] = useState({ ot_id: '', trabajador_id: '', fecha: new Date().toISOString().split('T')[0], horas_normales: 8, horas_extra: 0, ubicacion: 'Taller', actividad: '' });
  const [newExpense, setNewExpense] = useState({ ot_id: '', fecha: new Date().toISOString().split('T')[0], clasificacion: 'INSUMOS', detalle: '', cantidad: 1, valor_neto: '' });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [otsData, workersData, hhData, expensesData] = await Promise.all([
        api('/ots'),
        api('/trabajadores'),
        api('/hh'),
        api('/gastos')
      ]);
      // Filtrar OTs para no ver las ya cerradas si es necesario, o mostrar operativas.
      // Mostramos OTs que no estén "Facturada"
      setOts(otsData.filter(o => o.estado !== 'Facturada'));
      setWorkers(workersData);
      setHhRecords(hhData);
      setExpenseRecords(expensesData);
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
    if (activeTab === 'ots') {
      document.title = 'Trimec - OTs Activas';
    } else if (activeTab === 'hh') {
      document.title = 'Trimec - Control de Asistencia (HH)';
    } else {
      document.title = 'Trimec - Gastos de Terreno';
    }
  }, [activeTab]);

  const handleRegisterHh = async (e) => {
    e.preventDefault();
    try {
      await api('/hh', {
        method: 'POST',
        body: JSON.stringify({
          ...newHh,
          ot_id: newHh.ot_id,
          trabajador_id: parseInt(newHh.trabajador_id),
          horas_normales: parseFloat(newHh.horas_normales),
          horas_extra: parseFloat(newHh.horas_extra)
        }),
      });
      showToast('Horas registradas correctamente', 'success');
      setNewHh({ ...newHh, horas_normales: 8, horas_extra: 0, actividad: '' });
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleRegisterExpense = async (e) => {
    e.preventDefault();
    const net = parseFloat(newExpense.valor_neto) || 0;
    const iva = net * 0.19;
    const total = net + iva;

    try {
      await api('/gastos', {
        method: 'POST',
        body: JSON.stringify({
          ...newExpense,
          ot_id: newExpense.ot_id,
          cantidad: parseFloat(newExpense.cantidad),
          valor_neto: net,
          valor_iva: iva,
          valor_total: total
        }),
      });
      showToast('Gasto registrado correctamente', 'success');
      setNewExpense({ ...newExpense, detalle: '', cantidad: 1, valor_neto: '' });
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDeleteHh = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este registro de horas?')) return;
    try {
      await api(`/hh/${id}`, { method: 'DELETE' });
      showToast('Registro de horas eliminado', 'success');
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este gasto?')) return;
    try {
      await api(`/gastos/${id}`, { method: 'DELETE' });
      showToast('Gasto eliminado con éxito', 'success');
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  return (
    <div className="dashboard-container">
      <div className="dashboard-title-bar">
        <div>
          <h2>Panel de Supervisor (Operaciones)</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Ingreso rápido de asistencia, horas extra y compras en terreno</p>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'ots' ? 'active' : ''}`} onClick={() => setActiveTab('ots')}>
          📋 OTs Activas ({ots.length})
        </button>
        <button className={`tab-btn ${activeTab === 'hh' ? 'active' : ''}`} onClick={() => setActiveTab('hh')}>
          ⏱️ Registro de Horas (HH)
        </button>
        <button className={`tab-btn ${activeTab === 'gastos' ? 'active' : ''}`} onClick={() => setActiveTab('gastos')}>
          💸 Gastos Diarios
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando datos...</p>
      ) : (
        <div>
          {/* TAB 1: ACTIVE OTS */}
          {activeTab === 'ots' && (() => {
            const filteredOts = ots.filter(ot => 
              ot.id.toString().includes(searchQuery) ||
              ot.cliente_nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
              ot.detalle.toLowerCase().includes(searchQuery.toLowerCase())
            );
            return (
              <div className="panel-card">
                <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
                  <h3>Órdenes de Trabajo en Ejecución</h3>
                </div>

                <div className="search-container">
                  <span className="search-icon-placeholder">🔍</span>
                  <input 
                    type="text" 
                    className="search-control" 
                    placeholder="Buscar OT activa..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="ot-grid">
                  {filteredOts.map(ot => (
                    <div className="ot-card" key={ot.id}>
                      <div className="ot-card-header">
                        <span className="ot-card-num">OT {ot.id}</span>
                        <span className={`badge badge-${ot.estado.toLowerCase().replace(' ', '')}`}>{ot.estado}</span>
                      </div>
                      <div className="ot-card-client">{ot.cliente_nombre}</div>
                      <div className="ot-card-detail">{ot.detalle}</div>
                      <div style={{ marginTop: '1rem' }}>
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => onSelectOt(ot.id)}>
                          🔍 Ver Detalles y Costos
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredOts.length === 0 && (
                    <p style={{ color: 'var(--text-secondary)', padding: '1rem', gridColumn: '1 / -1', textAlign: 'center' }}>
                      No se encontraron OTs con los criterios de búsqueda.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* TAB 2: HORAS HOMBRE */}
          {activeTab === 'hh' && (
            <div className="dashboard-layout">
              {/* Form */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Imputar Horas de Trabajo Diarias</h3>
                </div>
                <form onSubmit={handleRegisterHh}>
                  <div className="form-group">
                    <label>Orden de Trabajo (OT)</label>
                    <select className="form-control" value={newHh.ot_id} onChange={(e) => setNewHh({ ...newHh, ot_id: e.target.value })} required>
                      <option value="">-- Seleccionar OT --</option>
                      {ots.map(o => <option key={o.id} value={o.id}>OT {o.id} - {o.cliente_nombre}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Trabajador</label>
                    <select className="form-control" value={newHh.trabajador_id} onChange={(e) => setNewHh({ ...newHh, trabajador_id: e.target.value })} required>
                      <option value="">-- Seleccionar Trabajador --</option>
                      {workers.map(w => <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>)}
                    </select>
                  </div>

                  <div className="flex-row-gap">
                    <div className="form-group flex-grow">
                      <label>Fecha de Ejecución</label>
                      <input type="date" className="form-control" value={newHh.fecha} onChange={(e) => setNewHh({ ...newHh, fecha: e.target.value })} required />
                    </div>
                    <div className="form-group flex-grow">
                      <label>Ubicación</label>
                      <select className="form-control" value={newHh.ubicacion} onChange={(e) => setNewHh({ ...newHh, ubicacion: e.target.value })}>
                        <option value="Taller">Taller</option>
                        <option value="Terreno">Terreno</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex-row-gap">
                    <div className="form-group flex-grow">
                      <label>Horas Normales (9 max/día)</label>
                      <input type="number" step="0.5" className="form-control" value={newHh.horas_normales} onChange={(e) => setNewHh({ ...newHh, horas_normales: e.target.value })} required />
                    </div>
                    <div className="form-group flex-grow">
                      <label>Horas Extra</label>
                      <input type="number" step="0.5" className="form-control" value={newHh.horas_extra} onChange={(e) => setNewHh({ ...newHh, horas_extra: e.target.value })} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Actividad Realizada</label>
                    <input type="text" className="form-control" placeholder="Ej: Confección de patines estructurales" value={newHh.actividad} onChange={(e) => setNewHh({ ...newHh, actividad: e.target.value })} required />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Registrar Horas</button>
                </form>
              </div>

              {/* List */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Historial Reciente de Registro de HH</h3>
                </div>
                <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>OT</th>
                        <th>Trabajador</th>
                        <th>Horas (N/E)</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hhRecords.slice(0, 30).map(rec => (
                        <tr key={rec.id}>
                          <td>{rec.fecha}</td>
                          <td style={{ fontWeight: 700 }}>OT {rec.ot_id}</td>
                          <td>
                            <strong>{rec.trabajador_name || rec.trabajador_nombre}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{rec.actividad}</div>
                          </td>
                          <td>{rec.horas_normales}h / {rec.horas_extra}h</td>
                          <td>
                            <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDeleteHh(rec.id)}>
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                      {hhRecords.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>No hay horas cargadas.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: GASTOS */}
          {activeTab === 'gastos' && (
            <div className="dashboard-layout">
              {/* Form */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Cargar Gasto Diario a OT</h3>
                </div>
                <form onSubmit={handleRegisterExpense}>
                  <div className="form-group">
                    <label>Asociar a OT</label>
                    <select className="form-control" value={newExpense.ot_id} onChange={(e) => setNewExpense({ ...newExpense, ot_id: e.target.value })} required>
                      <option value="">-- Seleccionar OT --</option>
                      {ots.map(o => <option key={o.id} value={o.id}>OT {o.id} - {o.cliente_nombre}</option>)}
                    </select>
                  </div>

                  <div className="flex-row-gap">
                    <div className="form-group flex-grow">
                      <label>Categoría Gasto</label>
                      <select className="form-control" value={newExpense.clasificacion} onChange={(e) => setNewExpense({ ...newExpense, clasificacion: e.target.value })}>
                        <option value="INSUMOS">INSUMOS</option>
                        <option value="Almuerzo">Almuerzo / Alimentación</option>
                        <option value="Plotteo">Plotteo de Planos</option>
                        <option value="Peaje">Peajes y Transportes</option>
                        <option value="Combustible">Combustible</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>
                    <div className="form-group flex-grow">
                      <label>Fecha Compra</label>
                      <input type="date" className="form-control" value={newExpense.fecha} onChange={(e) => setNewExpense({ ...newExpense, fecha: e.target.value })} required />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Descripción / Detalle de Boleta</label>
                    <input type="text" className="form-control" placeholder="Ej: Polietileno manga negro 0.1x2x14m" value={newExpense.detalle} onChange={(e) => setNewExpense({ ...newExpense, detalle: e.target.value })} required />
                  </div>

                  <div className="flex-row-gap">
                    <div className="form-group flex-grow">
                      <label>Cantidad</label>
                      <input type="number" step="1" className="form-control" value={newExpense.cantidad} onChange={(e) => setNewExpense({ ...newExpense, cantidad: e.target.value })} required />
                    </div>
                    <div className="form-group flex-grow">
                      <label>Valor NETO Boleta ($)</label>
                      <input type="number" step="0.1" className="form-control" placeholder="Ej: 17647" value={newExpense.valor_neto} onChange={(e) => setNewExpense({ ...newExpense, valor_neto: e.target.value })} required />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                    {newExpense.valor_neto && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>IVA (19%): ${Math.round(parseFloat(newExpense.valor_neto) * 0.19).toLocaleString('es-CL')}</span>
                        <strong>Total Estimado: ${Math.round(parseFloat(newExpense.valor_neto) * 1.19).toLocaleString('es-CL')}</strong>
                      </div>
                    )}
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Registrar Gasto</button>
                </form>
              </div>

              {/* List */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Historial Reciente de Gastos de OTs</h3>
                </div>
                <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>OT</th>
                        <th>Detalle</th>
                        <th>Total ($)</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseRecords.slice(0, 30).map(rec => (
                        <tr key={rec.id}>
                          <td>{rec.fecha}</td>
                          <td style={{ fontWeight: 700 }}>OT {rec.ot_id}</td>
                          <td>
                            <strong>[{rec.clasificacion}]</strong> {rec.detalle}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cant: {rec.cantidad}</div>
                          </td>
                          <td className="text-right">${Math.round(rec.valor_total).toLocaleString('es-CL')}</td>
                          <td>
                            <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDeleteExpense(rec.id)}>
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                      {expenseRecords.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>No hay gastos cargados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardSupervisor;

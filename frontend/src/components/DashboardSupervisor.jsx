import React, { useState, useEffect } from 'react';
import api, { BASE_URL } from '../utils/api';

const WORKFLOW_STAGES = [
  { id: '2', name: '2. En Ejecución / OT', color: '#8b5cf6', statuses: ['En Ejecución', 'Presupuestada', 'Aprobada', 'En Proceso'] }
];

const ALL_STAGES_LIST = [
  { id: '1', name: '1. SP', color: '#f59e0b', statuses: ['SP'] },
  { id: '2', name: '2. En Ejecución / OT', color: '#8b5cf6', statuses: ['En Ejecución', 'Presupuestada', 'Aprobada', 'En Proceso'] },
  { id: '3', name: '3. Liquidar', color: '#06b6d4', statuses: ['Liquidar', 'Terminada', 'Liquidada'] },
  { id: '4', name: '4. Facturar', color: '#10b981', statuses: ['Facturar', 'Facturada'] },
  { id: '5', name: '5. Cerradas', color: '#64748b', statuses: ['Cerrada', 'Cerradas'] }
];

const getOtSemaforo = (ot) => {
  if (!ot) return { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '⚪ N/A', code: 'INDET' };
  const isSp = ot.estado === 'SP';
  const today = new Date();
  today.setHours(0,0,0,0);

  if (isSp) {
    if (ot.fecha_envio_presupuesto) {
      return {
        color: '#a855f7',
        bgColor: 'rgba(168, 85, 247, 0.18)',
        border: '#a855f7',
        text: '🟣 Presupuesto Enviado',
        code: 'ENVIADO'
      };
    }

    let deadline = null;
    if (ot.fecha_proyectada_presupuesto) {
      deadline = new Date(ot.fecha_proyectada_presupuesto + 'T00:00:00');
    } else if (ot.fecha_solicitud) {
      deadline = new Date(ot.fecha_solicitud + 'T00:00:00');
      deadline.setDate(deadline.getDate() + 3);
    }

    if (!deadline || isNaN(deadline.getTime())) {
      return { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '⚪ Sin Fecha Límite', code: 'INDET' };
    }

    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: `🔴 Vencido (${Math.abs(diffDays)}d atraso)`, code: 'ROJO' };
    }
    if (diffDays <= 1) {
      return { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: `🟡 Vence ${diffDays === 0 ? 'Hoy' : 'Mañana'}`, code: 'AMARILLO' };
    }
    return { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: `🟢 En Plazo (${diffDays}d restantes)`, code: 'VERDE' };
  } else {
    if (!ot.fecha_entrega) {
      return { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '⚪ Sin Fecha Entrega', code: 'INDET' };
    }

    const deadline = new Date(ot.fecha_entrega + 'T00:00:00');
    if (isNaN(deadline.getTime())) {
      return { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '⚪ Fecha Inválida', code: 'INDET' };
    }

    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: `🔴 Retrasado (${Math.abs(diffDays)}d)`, code: 'ROJO' };
    }
    if (diffDays <= 1) {
      return { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: `🟡 Entrega ${diffDays === 0 ? 'Hoy' : 'Mañana'}`, code: 'AMARILLO' };
    }
    return { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: `🟢 En Plazo (${diffDays}d restantes)`, code: 'VERDE' };
  }
};

const DashboardSupervisor = ({ onSelectOt, showToast }) => {
  const [ots, setOts] = useState([]);
  const [selectedStageFilter, setSelectedStageFilter] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const handleMoveStatus = async (otId, currentStatus, direction) => {
    let currentIdx = ALL_STAGES_LIST.findIndex(s => s.statuses.includes(currentStatus));
    if (currentIdx === -1) currentIdx = 0;

    const nextIdx = currentIdx + direction;
    if (nextIdx >= 0 && nextIdx < ALL_STAGES_LIST.length) {
      const nextStage = ALL_STAGES_LIST[nextIdx];
      const nextStatus = nextStage.statuses[0];
      try {
        await api(`/ots/${otId}`, {
          method: 'PUT',
          body: JSON.stringify({ estado: nextStatus })
        });
        if (nextIdx >= 2) {
          showToast(`OT ${otId} enviada a Administración (${nextStage.name})`, 'success');
        } else {
          showToast(`OT ${otId}: Movida a ${nextStage.name}`, 'success');
        }
        fetchData();
      } catch (err) {
        showToast(err.message || 'Error al cambiar estado', 'danger');
      }
    }
  };
  const [activeTab, setActiveTab] = useState('ots'); // 'ots', 'bodega', 'hh', 'gastos'
  const [searchQuery, setSearchQuery] = useState('');

  // Lists for logs
  const [hhRecords, setHhRecords] = useState([]);
  const [expenseRecords, setExpenseRecords] = useState([]);

  // Edit States for HH & Expense
  const [editingHh, setEditingHh] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  // Bodega States
  const [inventario, setInventario] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ sku: '', descripcion: '', familia: '', unidad_medida: '', proveedor: '', stock: 0, ubicacion: '', valor_unitario: 0 });
  const [showMovModal, setShowMovModal] = useState(false);
  const [newMov, setNewMov] = useState({ tipo: 'ENTRADA', sku: '', fecha: new Date().toISOString().split('T')[0], cantidad: 0, valor_unitario: 0, factura_num: '', proveedor_o_cliente: '', ot_id: '' });

  // Form States
  const [newHh, setNewHh] = useState({ ot_id: '', trabajador_id: '', fecha: new Date().toISOString().split('T')[0], horas_normales: 8, horas_extra: 0, ubicacion: 'Taller', actividad: '' });
  const [newExpense, setNewExpense] = useState({ ot_id: '', fecha: new Date().toISOString().split('T')[0], clasificacion: 'INSUMOS', detalle: '', cantidad: 1, valor_neto: '' });

  const fetchInventario = async () => {
    try {
      const items = await api('/inventario');
      setInventario(items);
      const movs = await api('/inventario/movimientos');
      setMovimientos(movs);
    } catch (err) {
      showToast('Error al cargar inventario', 'danger');
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    try {
      await api('/inventario', {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      showToast('Consumible guardado con éxito', 'success');
      setShowItemModal(false);
      fetchInventario();
    } catch (err) {
      showToast(err.message || 'Error al guardar consumible', 'danger');
    }
  };

  const handleSaveMovimiento = async (e) => {
    e.preventDefault();
    try {
      await api('/inventario/movimiento', {
        method: 'POST',
        body: JSON.stringify(newMov)
      });
      showToast('Movimiento registrado con éxito', 'success');
      setShowMovModal(false);
      fetchInventario();
      fetchData();
    } catch (err) {
      showToast('Error al registrar movimiento', 'danger');
    }
  };

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
    } else if (activeTab === 'bodega') {
      document.title = 'Trimec - Bodega';
      fetchInventario();
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

  const handleUpdateHh = async (e) => {
    e.preventDefault();
    try {
      await api(`/hh/${editingHh.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ot_id: editingHh.ot_id,
          trabajador_id: parseInt(editingHh.trabajador_id),
          fecha: editingHh.fecha,
          horas_normales: parseFloat(editingHh.horas_normales),
          horas_extra: parseFloat(editingHh.horas_extra),
          ubicacion: editingHh.ubicacion,
          actividad: editingHh.actividad
        })
      });
      showToast('Registro de horas actualizado', 'success');
      setEditingHh(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleUpdateExpense = async (e) => {
    e.preventDefault();
    const net = parseFloat(editingExpense.valor_neto) || 0;
    const iva = net * 0.19;
    const total = net + iva;
    try {
      await api(`/gastos/${editingExpense.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ot_id: editingExpense.ot_id,
          fecha: editingExpense.fecha,
          clasificacion: editingExpense.clasificacion,
          detalle: editingExpense.detalle,
          cantidad: parseFloat(editingExpense.cantidad),
          valor_neto: net,
          valor_iva: iva,
          valor_total: total
        })
      });
      showToast('Gasto actualizado con éxito', 'success');
      setEditingExpense(null);
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
        <button className={`tab-btn ${activeTab === 'bodega' ? 'active' : ''}`} onClick={() => setActiveTab('bodega')}>📦 Bodega</button>
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
            const filteredOts = ots.filter(ot => {
              const matchesSearch = ot.id.toString().includes(searchQuery) ||
                ot.cliente_nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                ot.detalle.toLowerCase().includes(searchQuery.toLowerCase());
              
              if (!matchesSearch) return false;
              if (selectedStageFilter) {
                const stage = WORKFLOW_STAGES.find(s => s.id === selectedStageFilter);
                return stage ? stage.statuses.includes(ot.estado) : true;
              }
              return true;
            });
            return (
              <div>
                {/* WORKFLOW STAGES FILTER BAR SUPERVISOR */}
                <div className="panel-card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                      Etapas de Avance del Supervisor (OTs Activas)
                    </h4>
                    {selectedStageFilter && (
                      <button 
                        className="btn btn-secondary btn-sm" 
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }} 
                        onClick={() => setSelectedStageFilter(null)}
                      >
                        Ver Todas ({ots.length})
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    {WORKFLOW_STAGES.map((stage) => {
                      const count = ots.filter(o => stage.statuses.includes(o.estado)).length;
                      const isSelected = selectedStageFilter === stage.id;
                      return (
                        <div
                          key={stage.id}
                          onClick={() => setSelectedStageFilter(isSelected ? null : stage.id)}
                          style={{
                            background: isSelected ? stage.color : 'rgba(255,255,255,0.03)',
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                            border: `2px solid ${stage.color}`,
                            borderRadius: '0.75rem',
                            padding: '1rem',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? `0 4px 14px ${stage.color}55` : 'none',
                            transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                          }}
                        >
                          <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{count}</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '0.4rem', textTransform: 'uppercase' }}>{stage.name}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

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
                          <span 
                            className="ot-card-num" 
                            style={{ cursor: 'pointer', textDecoration: 'underline' }}
                            onClick={() => onSelectOt(ot.id)}
                            title="Ver detalles de la OT"
                          >
                            OT {ot.id}
                          </span>
                          <span className={`badge badge-${ot.estado.toLowerCase().replace(' ', '')}`}>{ot.estado}</span>
                        </div>
                        <div className="ot-card-client">{ot.cliente_nombre}</div>
                        <div className="ot-card-detail">{ot.detalle}</div>

                        {/* Stage Progress Control */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ flex: 1, fontSize: '0.75rem' }} 
                            title="Retroceder Estado"
                            onClick={() => handleMoveStatus(ot.id, ot.estado, -1)}
                            disabled={ot.estado === 'SP'}
                          >
                            ◀️ Retroceder
                          </button>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            style={{ flex: 1, fontSize: '0.75rem' }} 
                            title="Avanzar Estado"
                            onClick={() => handleMoveStatus(ot.id, ot.estado, 1)}
                          >
                            Avanzar ▶️
                          </button>
                        </div>

                        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => onSelectOt(ot.id)}>
                            🔍 Ver Detalles y Costos
                          </button>
                          <button className="btn btn-primary btn-sm" style={{ width: '100%' }} onClick={() => {
                            const token = localStorage.getItem('trimec_token');
                            window.open(`${BASE_URL}/ots/${ot.id}/pdf?token=${token || ''}`, '_blank');
                          }}>
                            📄 Presupuesto PDF
                          </button>
                        </div>
                      </div>
                    ))}
                    {filteredOts.length === 0 && (
                      <p style={{ color: 'var(--text-secondary)', padding: '1rem', gridColumn: '1 / -1', textAlign: 'center' }}>
                        No se encontraron OTs activas con los criterios seleccionados.
                      </p>
                    )}
                  </div>
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
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => setEditingHh({ ...rec })}>
                                ✏️
                              </button>
                              <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDeleteHh(rec.id)}>
                                🗑️
                              </button>
                            </div>
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
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => setEditingExpense({ ...rec })}>
                                ✏️
                              </button>
                              <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDeleteExpense(rec.id)}>
                                🗑️
                              </button>
                            </div>
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

          {/* TAB: BODEGA */}
          {activeTab === 'bodega' && (
            <div className="panel-card">
              <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <h3>Bodega de Insumos y Repuestos</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Artículos registrados y existencias de taller
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setNewItem({ sku: '', descripcion: '', familia: '', unidad_medida: '', proveedor: '', stock: 0, ubicacion: '', valor_unitario: 0, isEditing: false }); setShowItemModal(true); }}>
                    + Nuevo Artículo
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => { setNewMov({ tipo: 'ENTRADA', sku: '', fecha: new Date().toISOString().split('T')[0], cantidad: 0, valor_unitario: 0, factura_num: '', proveedor_o_cliente: '', ot_id: '' }); setShowMovModal(true); }}>
                    📥 Movimiento
                  </button>
                </div>
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Descripción</th>
                      <th>Familia</th>
                      <th>Ubicación</th>
                      <th>Stock</th>
                      <th>Costo Unitario</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventario.map(item => (
                      <tr key={item.sku}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.sku}</td>
                        <td>{item.descripcion}</td>
                        <td>{item.familia || '-'}</td>
                        <td>{item.ubicacion || '-'}</td>
                        <td>
                          <span className={`badge ${item.stock <= 2 ? 'badge-emergencia' : 'badge-aprobada'}`}>
                            {item.stock} {item.unidad_medida || 'unid'}
                          </span>
                        </td>
                        <td className="text-right">${Math.round(item.valor_unitario).toLocaleString('es-CL')}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => { setNewItem({ ...item, isEditing: true }); setShowItemModal(true); }}>
                            ✏️
                          </button>
                        </td>
                      </tr>
                    ))}
                    {inventario.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                          No hay artículos registrados en el inventario.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
      {/* MODALES BODEGA */}
      {showItemModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{newItem.sku ? 'Editar Artículo' : 'Registrar Nuevo Artículo'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowItemModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label>SKU (Código Único)</label>
                <input type="text" className="form-control" placeholder="Ej: EPP-GUANTES" value={newItem.sku} onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })} disabled={Boolean(newItem.isEditing || (newItem.sku && inventario.some(i => i.sku === newItem.sku)))} required />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <input type="text" className="form-control" placeholder="Ej: Guantes de cabritilla multifunción" value={newItem.descripcion} onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Familia</label>
                <select className="form-control" value={newItem.familia} onChange={(e) => setNewItem({ ...newItem, familia: e.target.value })}>
                  <option value="">-- Seleccionar Familia --</option>
                  <option value="EPP">EPP (Protección Personal)</option>
                  <option value="Repuesto">Repuesto</option>
                  <option value="Consumible">Consumible</option>
                </select>
              </div>
              <div className="form-group">
                <label>Unidad de Medida</label>
                <input type="text" className="form-control" placeholder="Ej: Par, Unidad, Litro, Kg" value={newItem.unidad_medida} onChange={(e) => setNewItem({ ...newItem, unidad_medida: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Proveedor</label>
                <input type="text" className="form-control" placeholder="Ej: Sodimac S.A." value={newItem.proveedor} onChange={(e) => setNewItem({ ...newItem, proveedor: e.target.value })} />
              </div>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Ubicación Física</label>
                  <input type="text" className="form-control" placeholder="Ej: Bodega Taller" value={newItem.ubicacion} onChange={(e) => setNewItem({ ...newItem, ubicacion: e.target.value })} />
                </div>
                {!newItem.sku && (
                  <div className="form-group flex-grow">
                    <label>Stock Inicial</label>
                    <input type="number" className="form-control" value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: parseFloat(e.target.value) })} required />
                  </div>
                )}
                <div className="form-group flex-grow">
                  <label>Costo Unitario ($)</label>
                  <input type="number" className="form-control" value={newItem.valor_unitario} onChange={(e) => setNewItem({ ...newItem, valor_unitario: parseFloat(e.target.value) })} required />
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Guardar</button>
            </form>
          </div>
        </div>
      )}

      {showMovModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Movimiento de Inventario</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMovModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveMovimiento}>
              <div className="form-group">
                <label>Tipo Movimiento</label>
                <select className="form-control" value={newMov.tipo} onChange={(e) => setNewMov({ ...newMov, tipo: e.target.value })}>
                  <option value="ENTRADA">ENTRADA (Aumento de Stock / Compra)</option>
                  <option value="SALIDA">SALIDA (Consumo de taller / Despacho)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Seleccionar SKU Artículo</label>
                <select className="form-control" value={newMov.sku} onChange={(e) => setNewMov({ ...newMov, sku: e.target.value })} required>
                  <option value="">-- Seleccionar SKU --</option>
                  {inventario.map(i => <option key={i.sku} value={i.sku}>{i.sku} - {i.descripcion} (Stock: {i.stock})</option>)}
                </select>
              </div>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Cantidad</label>
                  <input type="number" step="0.1" className="form-control" value={newMov.cantidad} onChange={(e) => setNewMov({ ...newMov, cantidad: parseFloat(e.target.value) })} required />
                </div>
                <div className="form-group flex-grow">
                  <label>Fecha Movimiento</label>
                  <input type="date" className="form-control" value={newMov.fecha} onChange={(e) => setNewMov({ ...newMov, fecha: e.target.value })} required />
                </div>
              </div>
              {newMov.tipo === 'ENTRADA' ? (
                <>
                  <div className="form-group">
                    <label>Factura / Guía N°</label>
                    <input type="text" className="form-control" value={newMov.factura_num} onChange={(e) => setNewMov({ ...newMov, factura_num: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Proveedor origen</label>
                    <input type="text" className="form-control" value={newMov.proveedor_o_cliente} onChange={(e) => setNewMov({ ...newMov, proveedor_o_cliente: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="form-group">
                  <label>Cargar a OT (Opcional)</label>
                  <select className="form-control" value={newMov.ot_id} onChange={(e) => setNewMov({ ...newMov, ot_id: e.target.value })}>
                    <option value="">-- Sin OT --</option>
                    {ots.map(o => <option key={o.id} value={o.id}>OT {o.id} - {o.cliente_nombre}</option>)}
                  </select>
                </div>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Registrar Movimiento</button>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: EDITAR HH */}
      {editingHh && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Editar Registro de Horas (HH)</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingHh(null)}>Cerrar</button>
            </div>
            <form onSubmit={handleUpdateHh}>
              <div className="form-group">
                <label>Asociar a OT</label>
                <select className="form-control" value={editingHh.ot_id} onChange={(e) => setEditingHh({ ...editingHh, ot_id: e.target.value })} required>
                  <option value="">-- Seleccionar --</option>
                  {ots.map(o => <option key={o.id} value={o.id}>OT {o.id} - {o.cliente_nombre}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Trabajador</label>
                <select className="form-control" value={editingHh.trabajador_id} onChange={(e) => setEditingHh({ ...editingHh, trabajador_id: e.target.value })} required>
                  <option value="">-- Seleccionar --</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>)}
                </select>
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Fecha</label>
                  <input type="date" className="form-control" value={editingHh.fecha} onChange={(e) => setEditingHh({ ...editingHh, fecha: e.target.value })} required />
                </div>
                <div className="form-group flex-grow">
                  <label>Ubicación</label>
                  <select className="form-control" value={editingHh.ubicacion || 'Taller'} onChange={(e) => setEditingHh({ ...editingHh, ubicacion: e.target.value })}>
                    <option value="Taller">Taller</option>
                    <option value="Terreno">Terreno</option>
                  </select>
                </div>
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Horas Normales</label>
                  <input type="number" step="0.5" className="form-control" value={editingHh.horas_normales} onChange={(e) => setEditingHh({ ...editingHh, horas_normales: e.target.value })} required />
                </div>
                <div className="form-group flex-grow">
                  <label>Horas Extra</label>
                  <input type="number" step="0.5" className="form-control" value={editingHh.horas_extra} onChange={(e) => setEditingHh({ ...editingHh, horas_extra: e.target.value })} required />
                </div>
              </div>

              <div className="form-group">
                <label>Actividad Realizada</label>
                <input type="text" className="form-control" value={editingHh.actividad} onChange={(e) => setEditingHh({ ...editingHh, actividad: e.target.value })} required />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR GASTO */}
      {editingExpense && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Editar Gasto Diario</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingExpense(null)}>Cerrar</button>
            </div>
            <form onSubmit={handleUpdateExpense}>
              <div className="form-group">
                <label>Asociar a OT</label>
                <select className="form-control" value={editingExpense.ot_id} onChange={(e) => setEditingExpense({ ...editingExpense, ot_id: e.target.value })} required>
                  <option value="">-- Seleccionar --</option>
                  {ots.map(o => <option key={o.id} value={o.id}>OT {o.id} - {o.cliente_nombre}</option>)}
                </select>
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Categoría Gasto</label>
                  <select className="form-control" value={editingExpense.clasificacion} onChange={(e) => setEditingExpense({ ...editingExpense, clasificacion: e.target.value })}>
                    <option value="INSUMOS">INSUMOS</option>
                    <option value="Almuerzo">Almuerzo / Alimentación</option>
                    <option value="Plotteo">Plotteo de Planos</option>
                    <option value="Peaje">Peajes y Transportes</option>
                    <option value="Combustible">Combustible</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div className="form-group flex-grow">
                  <label>Fecha</label>
                  <input type="date" className="form-control" value={editingExpense.fecha} onChange={(e) => setEditingExpense({ ...editingExpense, fecha: e.target.value })} required />
                </div>
              </div>

              <div className="form-group">
                <label>Descripción / Detalle</label>
                <input type="text" className="form-control" value={editingExpense.detalle} onChange={(e) => setEditingExpense({ ...editingExpense, detalle: e.target.value })} required />
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Cantidad</label>
                  <input type="number" step="any" className="form-control" value={editingExpense.cantidad} onChange={(e) => setEditingExpense({ ...editingExpense, cantidad: e.target.value })} required />
                </div>
                <div className="form-group flex-grow">
                  <label>Valor NETO ($)</label>
                  <input type="number" step="0.1" className="form-control" value={editingExpense.valor_neto} onChange={(e) => setEditingExpense({ ...editingExpense, valor_neto: e.target.value })} required />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardSupervisor;

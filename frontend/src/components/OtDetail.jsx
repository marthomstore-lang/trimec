import React, { useState, useEffect } from 'react';
import api, { BASE_URL } from '../utils/api';

const OtDetail = ({ otId, onBack, userRole, showToast }) => {
  const [ot, setOt] = useState(null);
  const [hhList, setHhList] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state for Admin/Supervisor to change details
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [clients, setClients] = useState([]);
  const [workers, setWorkers] = useState([]);

  // HH inline form
  const [showAddHhForm, setShowAddHhForm] = useState(false);
  const [newHh, setNewHh] = useState({
    trabajador_id: '',
    fecha: new Date().toISOString().split('T')[0],
    horas_normales: 8,
    horas_extra: 0,
    ubicacion: 'Taller',
    actividad: ''
  });

  // Expense inline form
  const [showAddExpenseForm, setShowAddExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({
    fecha: new Date().toISOString().split('T')[0],
    clasificacion: 'INSUMOS',
    detalle: '',
    cantidad: 1,
    valor_neto: ''
  });

  // Inventario / Consumo States
  const [inventario, setInventario] = useState([]);
  const [showAddConsumoForm, setShowAddConsumoForm] = useState(false);
  const [newConsumo, setNewConsumo] = useState({ sku: '', cantidad: 1, fecha: new Date().toISOString().split('T')[0] });

  // Informe Técnico States
  const [informe, setInforme] = useState(null);
  const [isEditingInforme, setIsEditingInforme] = useState(false);
  const [informeForm, setInformeForm] = useState({ antes_condicion: '', despues_tareas: '', recomendaciones: '', fotos_antes: '[]', fotos_despues: '[]' });
  const [showInformePreview, setShowInformePreview] = useState(false);

  const fetchOtDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const [otData, hhData, expensesData, clientsData, filesData, workersData, inventarioData, informeData] = await Promise.all([
        api(`/ots/${otId}`),
        api(`/hh/ot/${otId}`),
        api(`/gastos/ot/${otId}`),
        ['admin', 'supervisor', 'contador'].includes(userRole) ? api('/clientes') : Promise.resolve([]),
        api(`/ots/${otId}/archivos`),
        api('/trabajadores'),
        api('/inventario').catch(() => []),
        api(`/informes/ot/${otId}`).catch(() => null)
      ]);
      setOt(otData);
      setHhList(hhData);
      setExpenses(expensesData);
      setClients(clientsData);
      setFiles(filesData);
      setWorkers(workersData);
      setEditForm({ ...otData, nuevo_id: otData.id, modificar_id: false });
      setInventario(inventarioData);
      setInforme(informeData);
      if (informeData) {
        setInformeForm(informeData);
      } else {
        setInformeForm({ antes_condicion: '', despues_tareas: '', recomendaciones: '', fotos_antes: '[]', fotos_despues: '[]' });
      }
    } catch (err) {
      setError(err.message || 'Error al cargar los detalles de la OT');
    } finally {
      setLoading(false);
    }
  };

  const handleAddConsumoSubmit = async (e) => {
    e.preventDefault();
    try {
      const selectedItem = inventario.find(i => i.sku === newConsumo.sku);
      if (!selectedItem) {
        showToast('Insumo no encontrado', 'danger');
        return;
      }
      if (selectedItem.stock < newConsumo.cantidad) {
        if (!window.confirm(`El stock disponible (${selectedItem.stock}) es menor a la cantidad solicitada (${newConsumo.cantidad}). ¿Desea proceder de todas formas?`)) {
          return;
        }
      }
      await api('/inventario/movimiento', {
        method: 'POST',
        body: JSON.stringify({
          tipo: 'SALIDA',
          sku: newConsumo.sku,
          cantidad: parseFloat(newConsumo.cantidad),
          fecha: newConsumo.fecha,
          valor_unitario: selectedItem.valor_unitario,
          proveedor_o_cliente: 'Despacho OT',
          ot_id: otId
        })
      });
      showToast('Consumo de inventario registrado y cargado a la OT', 'success');
      setShowAddConsumoForm(false);
      setNewConsumo({ sku: '', cantidad: 1, fecha: new Date().toISOString().split('T')[0] });
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al registrar consumo', 'danger');
    }
  };

  const handleSaveInformeSubmit = async (e) => {
    e.preventDefault();
    try {
      await api(`/informes/ot/${otId}`, {
        method: 'POST',
        body: JSON.stringify(informeForm)
      });
      showToast('Informe técnico guardado con éxito', 'success');
      setIsEditingInforme(false);
      const updatedInfo = await api(`/informes/ot/${otId}`);
      setInforme(updatedInfo);
    } catch (err) {
      showToast(err.message || 'Error al guardar informe técnico', 'danger');
    }
  };

  useEffect(() => {
    fetchOtDetail();
  }, [otId]);

  useEffect(() => {
    if (ot && ot.id) {
      document.title = `Trimec - OT ${ot.id}`;
    } else {
      document.title = 'Trimec - Detalle de OT';
    }
  }, [ot]);
  const handleAddHhSubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/hh', {
        method: 'POST',
        body: JSON.stringify({
          ot_id: otId,
          trabajador_id: parseInt(newHh.trabajador_id),
          fecha: newHh.fecha,
          horas_normales: parseFloat(newHh.horas_normales),
          horas_extra: parseFloat(newHh.horas_extra),
          ubicacion: newHh.ubicacion,
          actividad: newHh.actividad
        })
      });
      showToast('Horas imputadas con éxito', 'success');
      setShowAddHhForm(false);
      setNewHh({
        trabajador_id: '',
        fecha: new Date().toISOString().split('T')[0],
        horas_normales: 8,
        horas_extra: 0,
        ubicacion: 'Taller',
        actividad: ''
      });
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al imputar horas', 'danger');
    }
  };

  const handleAddExpenseSubmit = async (e) => {
    e.preventDefault();
    const net = parseFloat(newExpense.valor_neto) || 0;
    const iva = net * 0.19;
    const total = net + iva;
    try {
      await api('/gastos', {
        method: 'POST',
        body: JSON.stringify({
          ot_id: otId,
          fecha: newExpense.fecha,
          clasificacion: newExpense.clasificacion,
          detalle: newExpense.detalle,
          cantidad: parseFloat(newExpense.cantidad),
          valor_neto: net,
          valor_iva: iva,
          valor_total: total
        })
      });
      showToast('Gasto registrado con éxito', 'success');
      setShowAddExpenseForm(false);
      setNewExpense({
        fecha: new Date().toISOString().split('T')[0],
        clasificacion: 'INSUMOS',
        detalle: '',
        cantidad: 1,
        valor_neto: ''
      });
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al registrar gasto', 'danger');
    }
  };
  const handleStatusChange = async (newStatus) => {
    try {
      await api(`/ots/${otId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...ot,
          estado: newStatus
        })
      });
      showToast(`Estado de la OT cambiado a ${newStatus}`, 'success');
      fetchOtDetail();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleUpdateOtDetails = async (e) => {
    e.preventDefault();
    try {
      const res = await api(`/ots/${otId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      showToast('Detalles de OT actualizados', 'success');
      setIsEditing(false);
      if (res.nuevo_id && res.nuevo_id !== otId) {
        onBack(); // Volver atrás si el ID cambia para forzar refresco
      } else {
        fetchOtDetail();
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast('El archivo es demasiado grande (máximo 5MB)', 'danger');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await api(`/ots/${otId}/archivos`, {
          method: 'POST',
          body: JSON.stringify({
            filename: file.name,
            filetype: file.type,
            base64Data: reader.result
          })
        });
        showToast('Documento subido correctamente', 'success');
        const updatedFiles = await api(`/ots/${otId}/archivos`);
        setFiles(updatedFiles);
      } catch (err) {
        showToast(err.message || 'Error al subir archivo', 'danger');
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      showToast('Error al leer el archivo', 'danger');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteFile = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este documento?')) return;
    try {
      await api(`/archivos/${id}`, { method: 'DELETE' });
      showToast('Archivo eliminado', 'success');
      const updatedFiles = await api(`/ots/${otId}/archivos`);
      setFiles(updatedFiles);
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDownloadPdf = () => {
    // Redireccionar al endpoint para descargar el PDF directamente
    const token = localStorage.getItem('trimec_token');
    window.open(`${BASE_URL}/ots/${otId}/pdf?token=${token || ''}`, '_blank');
  };

  if (loading) return <p style={{ textAlign: 'center', padding: '3rem' }}>Cargando detalles de la OT {otId}...</p>;
  if (error) return <div style={{ padding: '2rem', textAlign: 'center' }}><p className="text-danger">{error}</p><button className="btn btn-secondary mt-4" onClick={onBack}>Volver</button></div>;
  if (!ot) return <p style={{ textAlign: 'center' }}>No se encontró la OT</p>;

  // Calculated values
  const totalHh = ot.costo_hh || 0;
  const totalExpenses = ot.costo_gastos || 0;
  const totalCost = ot.costo_total || 0;
  const budget = ot.monto_neto_presupuesto || 0;
  const profit = ot.margen_monto || 0;
  const marginPct = ot.margen_porcentaje || 0;

  // Visual Bar calculations (proportions)
  const hhPct = budget > 0 ? Math.min((totalHh / budget) * 100, 100) : 0;
  const expPct = budget > 0 ? Math.min((totalExpenses / budget) * 100, 100 - hhPct) : 0;
  const remainingPct = 100 - hhPct - expPct;

  // Estados pipeline
  const estadosList = ['SP', 'Presupuestada', 'Aprobada', 'En Proceso', 'Terminada', 'Liquidada', 'Facturada'];

  return (
    <div className="dashboard-container">
      <div className="dashboard-title-bar" style={{ marginBottom: '1.5rem' }}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '1rem' }}>
            ← Volver al Listado
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ display: 'inline' }}>OT {ot.id} - {ot.cliente_nombre}</h2>
            {ot.es_emergencia === 1 && <span className="badge badge-sp">EMERGENCIA</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {userRole === 'admin' && (
            <button className="btn btn-secondary" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Cancelar Edición' : '⚙️ Editar OT'}
            </button>
          )}
          <button className="btn btn-primary" onClick={handleDownloadPdf}>
            📄 Descargar Presupuesto PDF
          </button>
        </div>
      </div>

      {/* Visual Pipeline Status */}
      <div className="panel-card" style={{ padding: '1rem 1.5rem', marginBottom: '2rem' }}>
        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: 600 }}>Estado de la Orden de Trabajo</h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', overflowX: 'auto', padding: '0.5rem 0' }}>
          {estadosList.map((est, i) => {
            const isActive = estadosList.indexOf(ot.estado) >= i;
            const isCurrent = ot.estado === est;
            return (
              <div key={est} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1, minWidth: '80px', cursor: userRole === 'admin' ? 'pointer' : 'default' }} onClick={() => userRole === 'admin' ? handleStatusChange(est) : showToast('Solo el Administrador puede cambiar el estado de la OT', 'danger')}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: isCurrent ? 'var(--primary)' : isActive ? 'var(--accent-success)' : 'rgba(255,255,255,0.05)',
                  border: '2px solid',
                  borderColor: isCurrent ? '#fff' : isActive ? 'transparent' : 'var(--panel-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  color: isActive || isCurrent ? '#fff' : 'var(--text-muted)'
                }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: isCurrent ? '700' : '500', color: isCurrent ? 'var(--text-primary)' : isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>{est}</span>
              </div>
            );
          })}
        </div>
      </div>

      {isEditing ? (
        <div className="panel-card">
          <div className="panel-header">
            <h3>Editar Datos de la Orden de Trabajo</h3>
          </div>
          <form onSubmit={handleUpdateOtDetails}>
            <div style={{ display: 'flex', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                <input type="checkbox" checked={editForm.modificar_id || false} onChange={(e) => setEditForm({ ...editForm, modificar_id: e.target.checked })} />
                ¿Modificar Número de OT / SP?
              </label>
              {editForm.modificar_id && (
                <div className="flex-grow">
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nuevo Número de OT/SP</label>
                  <input type="text" className="form-control mt-1" value={editForm.nuevo_id || ''} onChange={(e) => setEditForm({ ...editForm, nuevo_id: e.target.value })} required />
                </div>
              )}
            </div>
            <div className="flex-row-gap">
              <div className="form-group flex-grow">
                <label>Cliente</label>
                <select className="form-control" value={editForm.cliente_id} onChange={(e) => setEditForm({ ...editForm, cliente_id: parseInt(e.target.value) })} required>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>
              <div className="form-group flex-grow">
                <label>Monto Neto Presupuestado ($)</label>
                <input type="number" className="form-control" value={editForm.monto_neto_presupuesto} onChange={(e) => setEditForm({ ...editForm, monto_neto_presupuesto: parseFloat(e.target.value) })} required />
              </div>
              <div className="form-group flex-grow">
                <label>Horas Hombre Presupuestadas (Hrs)</label>
                <input type="number" className="form-control" value={editForm.hh_presupuestadas || ''} onChange={(e) => setEditForm({ ...editForm, hh_presupuestadas: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="form-group">
              <label>Descripción / Detalle del Trabajo</label>
              <textarea className="form-control" rows="3" value={editForm.detalle} onChange={(e) => setEditForm({ ...editForm, detalle: e.target.value })} required></textarea>
            </div>

            <div className="flex-row-gap">
              <div className="form-group flex-grow">
                <label>Fecha de Solicitud</label>
                <input type="date" className="form-control" value={editForm.fecha_solicitud || ''} onChange={(e) => setEditForm({ ...editForm, fecha_solicitud: e.target.value })} />
              </div>
              <div className="form-group flex-grow">
                <label>Fecha de Aprobación</label>
                <input type="date" className="form-control" value={editForm.fecha_aprobacion || ''} onChange={(e) => setEditForm({ ...editForm, fecha_aprobacion: e.target.value })} />
              </div>
              <div className="form-group flex-grow">
                <label>Fecha Estimada de Entrega</label>
                <input type="date" className="form-control" value={editForm.fecha_entrega || ''} onChange={(e) => setEditForm({ ...editForm, fecha_entrega: e.target.value })} />
              </div>
              <div className="form-group flex-grow">
                <label>Fecha Proyectada Presupuesto</label>
                <input type="date" className="form-control" value={editForm.fecha_proyectada_presupuesto || ''} onChange={(e) => setEditForm({ ...editForm, fecha_proyectada_presupuesto: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                <input type="checkbox" checked={editForm.es_emergencia === 1} onChange={(e) => setEditForm({ ...editForm, es_emergencia: e.target.checked ? 1 : 0 })} />
                ¿Es trabajo de Emergencia?
              </label>
              {editForm.es_emergencia === 1 && (
                <div className="flex-grow">
                  <label style={{ fontSize: '0.75rem' }}>% Recargo</label>
                  <input type="number" className="form-control" placeholder="Ej: 50" value={editForm.recargo_emergencia} onChange={(e) => setEditForm({ ...editForm, recargo_emergencia: parseFloat(e.target.value) || 0 })} />
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar Cambios</button>
          </form>
        </div>
      ) : (
        <div className="ot-detail-layout">
          {/* Left Column: General info and Cost Margin Visualiser */}
          <div>
            <div className="panel-card">
              <div className="panel-header">
                <h3>Resumen Técnico y Margen de Utilidad</h3>
              </div>
              
              <div className="info-grid mb-4">
                <div className="info-item">
                  <span className="info-item-label">Cliente / Solicitante</span>
                  <span className="info-item-value">{ot.cliente_nombre} <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>{ot.contacto_nombre || 'Sin contacto asignado'}</div></span>
                </div>
                <div className="info-item">
                  <span className="info-item-label">Fechas Clave</span>
                  <span className="info-item-value">
                    Solicitud: {ot.fecha_solicitud || 'N/A'}<br />
                    Aprobación: {ot.fecha_aprobacion || 'Pendiente'}<br />
                    Entrega: {ot.fecha_entrega || 'No definida'}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-item-label">Detalle Actividad</span>
                  <span className="info-item-value" style={{ fontStyle: 'italic' }}>"{ot.detalle}"</span>
                </div>
              </div>

              <div className={`margin-alert ${profit >= 0 ? 'positive' : 'danger'}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ fontWeight: 800, fontSize: '1.2rem' }}>
                      Margen Actual: ${Math.round(profit).toLocaleString('es-CL')} ({marginPct.toFixed(1)}%)
                    </h4>
                    <p style={{ fontSize: '0.85rem', color: 'inherit', opacity: 0.9 }}>
                      {profit >= 0 
                        ? 'El trabajo se encuentra actualmente dentro del presupuesto proyectado.' 
                        : '¡Alerta de pérdidas! Los costos reales han superado el monto neto cotizado.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Proportions Bar */}
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 600 }}>Distribución de Costos contra Presupuesto Neto</h4>
                <div style={{ width: '100%', height: '24px', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', overflow: 'hidden', display: 'flex' }}>
                  {totalCost > 0 ? (
                    <>
                      <div style={{ width: `${hhPct}%`, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }} title={`Costo HH: ${hhPct.toFixed(1)}%`}>
                        {hhPct > 10 && 'HH'}
                      </div>
                      <div style={{ width: `${expPct}%`, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }} title={`Gastos Directos: ${expPct.toFixed(1)}%`}>
                        {expPct > 10 && 'Gastos'}
                      </div>
                      {profit >= 0 ? (
                        <div style={{ width: `${remainingPct}%`, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }} title={`Margen Neto: ${remainingPct.toFixed(1)}%`}>
                          {remainingPct > 10 && 'Margen'}
                        </div>
                      ) : (
                        <div style={{ flexGrow: 1, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: '#fff', fontWeight: 'bold' }} title="Exceso de costo">
                          Exceso
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Sin costos cargados todavía
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-secondary)', justifyContent: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '12px', height: '12px', background: '#3b82f6', borderRadius: '3px' }}></span> Horas Hombre (${Math.round(totalHh).toLocaleString('es-CL')})</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></span> Gastos Diarios (${Math.round(totalExpenses).toLocaleString('es-CL')})</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><span style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '3px' }}></span> Margen Neto (${Math.round(profit).toLocaleString('es-CL')})</span>
                </div>
              </div>

              {/* Rendimiento de Horas Hombre (Labor Efficiency) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem', fontWeight: 600 }}>Rendimiento de Mano de Obra</h4>
                
                {ot.hh_presupuestadas > 0 ? (() => {
                  const actualHhHours = hhList.reduce((acc, curr) => acc + (curr.horas_normales + curr.horas_extra), 0);
                  const hhPct = (actualHhHours / ot.hh_presupuestadas) * 100;
                  const diffHh = ot.hh_presupuestadas - actualHhHours;
                  const isEficiente = diffHh >= 0;
                  
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                        <span>Horas Consumidas: <strong>{actualHhHours.toFixed(1)} hrs</strong> de <strong>{ot.hh_presupuestadas.toFixed(1)} hrs</strong></span>
                        <span style={{ color: isEficiente ? '#34d399' : '#f87171' }}>{hhPct.toFixed(1)}% utilizado</span>
                      </div>

                      {/* progress bar */}
                      <div style={{ width: '100%', height: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '99px', overflow: 'hidden', marginBottom: '1rem' }}>
                        <div style={{ width: `${Math.min(hhPct, 100)}%`, background: isEficiente ? '#10b981' : '#ef4444', height: '100%' }}></div>
                      </div>

                      <div className={`margin-alert ${isEficiente ? 'positive' : 'danger'}`} style={{ margin: 0, padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.1rem' }}>{isEficiente ? '✓' : '⚠️'}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                          {isEficiente 
                            ? `¡Ahorro de ${diffHh.toFixed(1)} HH! La tarea se está ejecutando dentro del presupuesto.` 
                            : `¡Desviación de ${Math.abs(diffHh).toFixed(1)} HH! Se han excedido las horas estimadas.`}
                        </span>
                      </div>
                    </div>
                  );
                })() : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px dashed var(--panel-border)', textAlign: 'center' }}>
                    Sin horas presupuestadas cargadas en esta OT. Edita los datos de la OT para asignar horas estimadas de mano de obra.
                  </p>
                )}
              </div>
            </div>

            {/* Invoicing Section */}
            {ot.facturacion && (
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Estados Financieros y Facturación (SII)</h3>
                </div>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-item-label">Orden de Compra (OC)</span>
                    <span className="info-item-value">{ot.facturacion.nro_oc ? `${ot.facturacion.nro_oc} (${ot.facturacion.fecha_oc})` : <span style={{ color: 'var(--text-danger)' }}>Falta OC del cliente</span>}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-item-label">Entrada Servicio HES</span>
                    <span className="info-item-value">{ot.facturacion.nro_hes || <span style={{ color: 'var(--text-muted)' }}>Pendiente emisión</span>}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-item-label">Factura Emitida</span>
                    <span className="info-item-value">{ot.facturacion.nro_factura ? `${ot.facturacion.nro_factura} (${ot.facturacion.fecha_factura})` : <span style={{ color: 'var(--text-muted)' }}>Sin facturar</span>}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-item-label">Estado de Cobro</span>
                    <span className="info-item-value">
                      <span className={`badge ${ot.facturacion.estado_pago === 'Pagado' ? 'badge-aprobada' : ot.facturacion.estado_pago === 'Anulado' ? 'badge-sp' : 'badge-presupuestada'}`}>
                        {ot.facturacion.estado_pago}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Attachments Section */}
            <div className="panel-card" style={{ marginTop: '1.5rem' }}>
              <div className="panel-header" style={{ marginBottom: '1rem' }}>
                <h3>Documentos y Fotos Adjuntos</h3>
                <span className="badge badge-terminada">{`${files.length} archivos`}</span>
              </div>
              
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="btn btn-secondary btn-sm" style={{ display: 'block', textAlign: 'center', cursor: 'pointer', opacity: uploading ? 0.6 : 1, padding: '0.5rem' }}>
                  {uploading ? 'Subiendo archivo...' : '➕ Adjuntar Documento o Foto'}
                  <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {files.map((file) => {
                  const isImage = file.tipo.startsWith('image/');
                  const fileUrl = (file.nombre_guardado && (file.nombre_guardado.startsWith('http://') || file.nombre_guardado.startsWith('https://')))
                    ? file.nombre_guardado 
                    : `${BASE_URL.replace('/api', '')}/uploads/${file.nombre_guardado}`;
                  return (
                    <div key={file.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--panel-border)', padding: '0.75rem', borderRadius: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden', flex: 1 }}>
                        {isImage ? (
                          <img src={fileUrl} alt={file.nombre_original} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--panel-border)' }} />
                        ) : (
                          <div style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>
                            📄
                          </div>
                        )}
                        <div style={{ overflow: 'hidden', flex: 1 }}>
                          <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {file.nombre_original}
                          </a>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Subido: {file.fecha_subida}</span>
                        </div>
                      </div>
                      {(userRole === 'admin' || userRole === 'supervisor') && (
                        <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', color: 'var(--accent-danger)', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1rem' }} onClick={() => handleDeleteFile(file.id)}>
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
                {files.length === 0 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                    No hay archivos adjuntos en esta OT.
                  </p>
                )}
              </div>
            </div>

            {/* Informe Técnico de Trabajo */}
            <div className="panel-card" style={{ marginTop: '1.5rem' }}>
              <div className="panel-header" style={{ marginBottom: '1rem' }}>
                <h3>Informe Técnico de Trabajo</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['admin', 'supervisor'].includes(userRole) && !isEditingInforme && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingInforme(true)}>
                      ✏️ Editar
                    </button>
                  )}
                  {informe && (
                    <button className="btn btn-primary btn-sm" onClick={() => setShowInformePreview(true)}>
                      📄 Vista Previa
                    </button>
                  )}
                </div>
              </div>

              {isEditingInforme ? (
                <form onSubmit={handleSaveInformeSubmit}>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Condición Inicial (Antes)</label>
                    <textarea 
                      className="form-control" 
                      rows="3" 
                      placeholder="Ej: Pasador de pivoteo con oreja cortada en balde..." 
                      value={informeForm.antes_condicion} 
                      onChange={(e) => setInformeForm({ ...informeForm, antes_condicion: e.target.value })}
                      required
                    ></textarea>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Tareas Ejecutadas (Después)</label>
                    <textarea 
                      className="form-control" 
                      rows="3" 
                      placeholder="Ej: Se retira pasador y oreja para proceder a biselar y soldar..." 
                      value={informeForm.despues_tareas} 
                      onChange={(e) => setInformeForm({ ...informeForm, despues_tareas: e.target.value })}
                      required
                    ></textarea>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label>Recomendaciones</label>
                    <textarea 
                      className="form-control" 
                      rows="2" 
                      placeholder="Ej: Engrasar pasador cada 50 horas de uso..." 
                      value={informeForm.recomendaciones} 
                      onChange={(e) => setInformeForm({ ...informeForm, recomendaciones: e.target.value })}
                    ></textarea>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditingInforme(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary btn-sm">Guardar Informe</button>
                  </div>
                </form>
              ) : informe ? (
                <div>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Condición Inicial:</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>{informe.antes_condicion}</p>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Tareas Ejecutadas:</strong>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>{informe.despues_tareas}</p>
                  </div>
                  {informe.recomendaciones && (
                    <div style={{ marginBottom: '1rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Recomendaciones:</strong>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>{informe.recomendaciones}</p>
                    </div>
                  )}
                  {/* Photo Simulation Captions */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                    <div style={{ border: '1px dashed var(--panel-border)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                      <span style={{ fontSize: '2rem' }}>📸</span>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.25rem' }}>EVIDENCIA: ANTES</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>[Imágenes en archivos adjuntos]</span>
                    </div>
                    <div style={{ border: '1px dashed var(--panel-border)', padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', background: 'rgba(255,255,255,0.01)' }}>
                      <span style={{ fontSize: '2rem' }}>📸</span>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', marginTop: '0.25rem' }}>EVIDENCIA: DESPUÉS</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>[Imágenes en archivos adjuntos]</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', border: '1px dashed var(--panel-border)', borderRadius: '0.75rem' }}>
                  No se ha redactado el informe técnico de entrega para esta OT.
                  {['admin', 'supervisor'].includes(userRole) && (
                    <button className="btn btn-secondary btn-sm" style={{ display: 'block', margin: '0.75rem auto 0 auto' }} onClick={() => setIsEditingInforme(true)}>
                      ✍️ Redactar Informe
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Logs of HH and Expenses */}
          <div>
            {/* HH Log */}
            <div className="panel-card">
              <div className="panel-header">
                <h3>Horas Hombre Imputadas</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {['admin', 'supervisor'].includes(userRole) && (
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowAddHhForm(!showAddHhForm)}>
                      {showAddHhForm ? 'Cancelar' : '➕ Imputar'}
                    </button>
                  )}
                  <span className="badge badge-proceso">{`${hhList.length} registros`}</span>
                </div>
              </div>

              {showAddHhForm && (
                <form onSubmit={handleAddHhSubmit} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--primary)' }}>Imputar Horas a esta OT</h4>
                  <div className="flex-row-gap" style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="form-group flex-grow" style={{ minWidth: '150px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Trabajador</label>
                      <select className="form-control" value={newHh.trabajador_id} onChange={(e) => setNewHh({ ...newHh, trabajador_id: e.target.value })} required>
                        <option value="">-- Seleccionar --</option>
                        {workers.map(w => <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ width: '130px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Fecha</label>
                      <input type="date" className="form-control" value={newHh.fecha} onChange={(e) => setNewHh({ ...newHh, fecha: e.target.value })} required />
                    </div>
                  </div>
                  <div className="flex-row-gap" style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ width: '90px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Hrs Norm.</label>
                      <input type="number" step="0.5" className="form-control" value={newHh.horas_normales} onChange={(e) => setNewHh({ ...newHh, horas_normales: e.target.value })} required />
                    </div>
                    <div className="form-group" style={{ width: '90px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Hrs Extra</label>
                      <input type="number" step="0.5" className="form-control" value={newHh.horas_extra} onChange={(e) => setNewHh({ ...newHh, horas_extra: e.target.value })} required />
                    </div>
                    <div className="form-group flex-grow" style={{ minWidth: '100px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Ubicación</label>
                      <select className="form-control" value={newHh.ubicacion} onChange={(e) => setNewHh({ ...newHh, ubicacion: e.target.value })}>
                        <option value="Taller">Taller</option>
                        <option value="Terreno">Terreno</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.75rem' }}>Actividad / Tareas Realizadas</label>
                    <input type="text" className="form-control" placeholder="Ej: Fabricación de soporte..." value={newHh.actividad} onChange={(e) => setNewHh({ ...newHh, actividad: e.target.value })} required />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddHhForm(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary btn-sm">Imputar HH</button>
                  </div>
                </form>
              )}

              <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Trabajador</th>
                      <th>Horas</th>
                      <th>Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hhList.map((hh) => (
                      <tr key={hh.id}>
                        <td>{hh.fecha}</td>
                        <td>
                          <strong>{hh.trabajador_nombre}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{hh.actividad}</div>
                        </td>
                        <td>N:{hh.horas_normales}h / E:{hh.horas_extra}h</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>${Math.round(hh.costo_calculado).toLocaleString('es-CL')}</td>
                      </tr>
                    ))}
                    {hhList.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Sin horas imputadas en esta OT.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses Log */}
            <div className="panel-card" style={{ marginTop: '1.5rem' }}>
              <div className="panel-header">
                <h3>Compras y Gastos Diarios</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {['admin', 'supervisor'].includes(userRole) && (
                    <>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddExpenseForm(!showAddExpenseForm); setShowAddConsumoForm(false); }}>
                        {showAddExpenseForm ? 'Cancelar' : '➕ Registrar Gasto'}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddConsumoForm(!showAddConsumoForm); setShowAddExpenseForm(false); }}>
                        {showAddConsumoForm ? 'Cancelar' : '📦 Consumir Insumo'}
                      </button>
                    </>
                  )}
                  <span className="badge badge-presupuestada">{`${expenses.length} registros`}</span>
                </div>
              </div>

              {showAddConsumoForm && (
                <form onSubmit={handleAddConsumoSubmit} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--primary)' }}>Despachar Insumo desde Inventario</h4>
                  <div className="flex-row-gap" style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="form-group flex-grow" style={{ minWidth: '200px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Seleccionar Artículo (SKU)</label>
                      <select className="form-control" value={newConsumo.sku} onChange={(e) => setNewConsumo({ ...newConsumo, sku: e.target.value })} required>
                        <option value="">-- Seleccionar --</option>
                        {inventario.map(i => <option key={i.sku} value={i.sku}>{i.sku} - {i.descripcion} (Stock: {i.stock})</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ width: '100px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Cantidad</label>
                      <input type="number" className="form-control" min="0.1" step="any" value={newConsumo.cantidad} onChange={(e) => setNewConsumo({ ...newConsumo, cantidad: parseFloat(e.target.value) || 0 })} required />
                    </div>
                    <div className="form-group" style={{ width: '130px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Fecha</label>
                      <input type="date" className="form-control" value={newConsumo.fecha} onChange={(e) => setNewConsumo({ ...newConsumo, fecha: e.target.value })} required />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddConsumoForm(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary btn-sm">Despachar y Cargar Gasto</button>
                  </div>
                </form>
              )}

              {showAddExpenseForm && (
                <form onSubmit={handleAddExpenseSubmit} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--primary)' }}>Registrar Gasto a esta OT</h4>
                  <div className="flex-row-gap" style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <div className="form-group flex-grow" style={{ minWidth: '150px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Categoría Gasto</label>
                      <select className="form-control" value={newExpense.clasificacion} onChange={(e) => setNewExpense({ ...newExpense, clasificacion: e.target.value })}>
                        <option value="INSUMOS">INSUMOS</option>
                        <option value="Almuerzo">Almuerzo / Alimentación</option>
                        <option value="Plotteo">Plotteo de Planos</option>
                        <option value="Peaje">Peajes y Transportes</option>
                        <option value="Combustible">Combustible</option>
                        <option value="Otros">Otros</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ width: '130px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Fecha</label>
                      <input type="date" className="form-control" value={newExpense.fecha} onChange={(e) => setNewExpense({ ...newExpense, fecha: e.target.value })} required />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.75rem' }}>Descripción / Detalle de Boleta</label>
                    <input type="text" className="form-control" placeholder="Ej: Polietileno manga negro..." value={newExpense.detalle} onChange={(e) => setNewExpense({ ...newExpense, detalle: e.target.value })} required />
                  </div>
                  <div className="flex-row-gap" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <div className="form-group" style={{ width: '80px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Cantidad</label>
                      <input type="number" className="form-control" value={newExpense.cantidad} onChange={(e) => setNewExpense({ ...newExpense, cantidad: e.target.value })} required />
                    </div>
                    <div className="form-group flex-grow" style={{ minWidth: '120px' }}>
                      <label style={{ fontSize: '0.75rem' }}>Valor NETO Boleta ($)</label>
                      <input type="number" step="0.1" className="form-control" placeholder="Ej: 25000" value={newExpense.valor_neto} onChange={(e) => setNewExpense({ ...newExpense, valor_neto: e.target.value })} required />
                    </div>
                  </div>

                  {newExpense.valor_neto && (
                    <div style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                      <span>IVA (19%): ${Math.round(parseFloat(newExpense.valor_neto) * 0.19).toLocaleString('es-CL')}</span>
                      <strong>Total Estimado: ${Math.round(parseFloat(newExpense.valor_neto) * 1.19).toLocaleString('es-CL')}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddExpenseForm(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary btn-sm">Registrar Gasto</button>
                  </div>
                </form>
              )}

              <div className="table-container" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Item</th>
                      <th>Neto</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td>{exp.fecha}</td>
                        <td>
                          <strong>[{exp.clasificacion}]</strong> {exp.detalle}
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cant: {exp.cantidad}</div>
                        </td>
                        <td className="text-right">${Math.round(exp.valor_neto).toLocaleString('es-CL')}</td>
                        <td className="text-right" style={{ fontWeight: 600 }}>${Math.round(exp.valor_total).toLocaleString('es-CL')}</td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Sin compras registradas para esta OT.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISTA PREVIA INFORME TÉCNICO FORMAL */}
      {showInformePreview && informe && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="modal-content" style={{ maxWidth: '800px', background: '#fff', color: '#333', padding: '2.5rem', borderRadius: '0.5rem', fontFamily: 'Arial, sans-serif' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #333', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, color: '#005b96', fontWeight: 'bold' }}>TRIMEC SpA</h2>
                <span style={{ fontSize: '0.8rem', color: '#666' }}>Servicios Metalmecánicos y Maestranza</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h3 style={{ margin: 0, color: '#333' }}>INFORME TÉCNICO</h3>
                <span style={{ fontWeight: 'bold', color: '#005b96' }}>OT-{otId}</span>
              </div>
            </div>

            {/* Header Table Info */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', color: '#333', fontSize: '0.9rem' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd', fontWeight: 'bold', width: '120px', background: '#f9f9f9' }}>Señores</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd' }}>{ot?.cliente_nombre || 'Cliente'}</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd', fontWeight: 'bold', width: '120px', background: '#f9f9f9' }}>Referencia</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd' }}>{ot?.detalle}</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd', fontWeight: 'bold', background: '#f9f9f9' }}>Ciudad</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd' }}>Yungay / Concepción</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd', fontWeight: 'bold', background: '#f9f9f9' }}>Contenido</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd' }}>Informe de Trabajo</td>
                </tr>
                <tr>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd', fontWeight: 'bold', background: '#f9f9f9' }}>Especialidad</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd' }}>Mecánico / Soldador</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd', fontWeight: 'bold', background: '#f9f9f9' }}>Ing. Mecánico</td>
                  <td style={{ padding: '0.4rem', border: '1px solid #ddd' }}>Angelo Muñoz V.</td>
                </tr>
              </tbody>
            </table>

            {/* Condicion Inicial y Tareas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
              <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#a94442', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>CONDICIÓN ACTUAL (ANTES)</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>{informe.antes_condicion}</p>
              </div>
              <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '4px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#3c763d', borderBottom: '1px solid #eee', paddingBottom: '0.25rem' }}>TAREAS EJECUTADAS (DESPUÉS)</h4>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.4' }}>{informe.despues_tareas}</p>
              </div>
            </div>

            {informe.recomendaciones && (
              <div style={{ marginTop: '1.5rem', border: '1px solid #bce8f1', background: '#d9edf7', padding: '1rem', borderRadius: '4px', color: '#31708f' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontWeight: 'bold' }}>RECOMENDACIONES POST-SERVICIO</h4>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>{informe.recomendaciones}</p>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem', borderTop: '1px solid #eee', paddingTop: '1.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ background: '#666', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                🖨️ Imprimir Reporte
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowInformePreview(false)} style={{ background: '#333', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                Cerrar Previsualización
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OtDetail;

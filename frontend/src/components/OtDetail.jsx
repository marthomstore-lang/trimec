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

  const fetchOtDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const [otData, hhData, expensesData, clientsData, filesData] = await Promise.all([
        api(`/ots/${otId}`),
        api(`/hh/ot/${otId}`),
        api(`/gastos/ot/${otId}`),
        userRole === 'admin' ? api('/clientes') : Promise.resolve([]),
        api(`/ots/${otId}/archivos`)
      ]);
      setOt(otData);
      setHhList(hhData);
      setExpenses(expensesData);
      setClients(clientsData);
      setFiles(filesData);
      setEditForm(otData);
    } catch (err) {
      setError(err.message || 'Error al cargar los detalles de la OT');
    } finally {
      setLoading(false);
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
      await api(`/ots/${otId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      showToast('Detalles de OT actualizados', 'success');
      setIsEditing(false);
      fetchOtDetail();
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
              <div key={est} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 2, flex: 1, minWidth: '80px', cursor: 'pointer' }} onClick={() => handleStatusChange(est)}>
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
                <span className="badge badge-terminada">{files.length} archivos</span>
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
          </div>

          {/* Right Column: Logs of HH and Expenses */}
          <div>
            {/* HH Log */}
            <div className="panel-card">
              <div className="panel-header">
                <h3>Horas Hombre Imputadas</h3>
                <span className="badge badge-proceso">{hhList.length} registros</span>
              </div>
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
                <span className="badge badge-presupuestada">{expenses.length} registros</span>
              </div>
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
    </div>
  );
};

export default OtDetail;

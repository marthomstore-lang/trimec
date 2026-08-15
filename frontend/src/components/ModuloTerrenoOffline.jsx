import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { saveOfflineItem, getOfflineQueue, removeOfflineItem, syncOfflineQueue } from '../utils/offlineStore';

const ModuloTerrenoOffline = ({ initialOtId = '', onBack, showToast }) => {
  const [activeTab, setActiveTab] = useState('traslados'); // 'traslados', 'gastos', 'hh', 'cola'
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [pendingQueue, setPendingQueue] = useState([]);
  
  // Datos maestro
  const [ots, setOts] = useState([]);
  const [workers, setWorkers] = useState([]);

  // Formulario Traslados / Kilometraje
  const [traslado, setTraslado] = useState({
    ot_id: initialOtId || '',
    trabajador_id: '',
    fecha: new Date().toISOString().split('T')[0],
    patente_vehiculo: '',
    km_inicio: '',
    km_termino: '',
    hora_salida_taller: '',
    hora_llegada_faena: '',
    hora_salida_faena: '',
    hora_llegada_taller: '',
    detalle_viaje: ''
  });

  // Formulario Gastos y Fotos
  const [gasto, setGasto] = useState({
    ot_id: initialOtId || '',
    fecha: new Date().toISOString().split('T')[0],
    clasificacion: 'Combustible',
    detalle: '',
    cantidad: 1,
    valor_neto: '',
    valor_iva: '',
    valor_total: '',
    foto_boleta: null
  });

  // Formulario HH Terreno
  const [hh, setHh] = useState({
    ot_id: initialOtId || '',
    trabajador_id: '',
    fecha: new Date().toISOString().split('T')[0],
    horas_normales: 8,
    horas_extra: 0,
    ubicacion: 'Terreno',
    actividad: ''
  });

  useEffect(() => {
    if (initialOtId) {
      setTraslado(prev => ({ ...prev, ot_id: initialOtId }));
      setGasto(prev => ({ ...prev, ot_id: initialOtId }));
      setHh(prev => ({ ...prev, ot_id: initialOtId }));
    }
  }, [initialOtId]);

  const cameraInputRef = useRef(null);

  // Escuchar estado de conexión de red
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast && showToast('🟢 Conexión restablecida. Sincronizando registros...', 'success');
      handleSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showToast && showToast('🔴 Dispositivo sin conexión. Activado Modo Offline Terreno.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadMasterData();
    loadQueue();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadMasterData = async () => {
    try {
      if (navigator.onLine) {
        const [otsData, workersData] = await Promise.all([
          api('/ots'),
          api('/trabajadores')
        ]);
        setOts(otsData);
        setWorkers(workersData);
        // Guardar respaldo local de maestros para autocompletar offline
        localStorage.setItem('trimec_cache_ots', JSON.stringify(otsData));
        localStorage.setItem('trimec_cache_workers', JSON.stringify(workersData));
      } else {
        const cachedOts = localStorage.getItem('trimec_cache_ots');
        const cachedWorkers = localStorage.getItem('trimec_cache_workers');
        if (cachedOts) setOts(JSON.parse(cachedOts));
        if (cachedWorkers) setWorkers(JSON.parse(cachedWorkers));
      }
    } catch (e) {
      console.warn('Cargando maestros desde caché local offline:', e);
      const cachedOts = localStorage.getItem('trimec_cache_ots');
      const cachedWorkers = localStorage.getItem('trimec_cache_workers');
      if (cachedOts) setOts(JSON.parse(cachedOts));
      if (cachedWorkers) setWorkers(JSON.parse(cachedWorkers));
    }
  };

  const loadQueue = async () => {
    const queue = await getOfflineQueue();
    setPendingQueue(queue);
  };

  const handleSyncQueue = async () => {
    if (!navigator.onLine) {
      showToast && showToast('No hay conexión a internet para sincronizar.', 'warning');
      return;
    }
    setSyncing(true);
    setSyncStatusMsg('Iniciando sincronización...');
    try {
      const res = await syncOfflineQueue(api, (msg) => setSyncStatusMsg(msg));
      if (res.syncedCount > 0) {
        showToast && showToast(`✅ Se sincronizaron ${res.syncedCount} registro(s) correctamente.`, 'success');
      }
    } catch (err) {
      showToast && showToast('Error durante la sincronización.', 'danger');
    } finally {
      setSyncing(false);
      setSyncStatusMsg('');
      loadQueue();
    }
  };

  const isLockedOt = (otId) => {
    const found = ots.find(o => String(o.id) === String(otId));
    if (!found) return false;
    return ['LIQ', 'Liquidada', 'FAC', 'Facturada', 'CER', 'Cerrada'].includes(found.estado);
  };

  // --- SUBMIT TRASLADO ---
  const handleSubmitTraslado = async (e) => {
    e.preventDefault();
    if (!traslado.ot_id || !traslado.trabajador_id || !traslado.patente_vehiculo) {
      showToast && showToast('Por favor, selecciona OT, Conductor y Patente.', 'warning');
      return;
    }

    if (isLockedOt(traslado.ot_id)) {
      showToast && showToast('🔒 La OT seleccionada se encuentra Liquidada / Facturada / Cerrada. No permite nuevos ingresos.', 'danger');
      return;
    }

    const payload = {
      ...traslado,
      km_inicio: parseFloat(traslado.km_inicio) || 0,
      km_termino: parseFloat(traslado.km_termino) || 0
    };

    if (navigator.onLine) {
      try {
        await api('/traslados', { method: 'POST', body: JSON.stringify(payload) });
        showToast && showToast('🚗 Registro de Kilometraje guardado exitosamente', 'success');
        resetTrasladoForm();
      } catch (err) {
        // Si falla por red, guardar offline
        await saveOfflineItem({
          type: 'TRASLADO',
          endpoint: '/traslados',
          payload,
          label: `Traslado Patente ${payload.patente_vehiculo} (OT ${payload.ot_id})`
        });
        showToast && showToast('Gasto guardado en cola local (Offline). Se enviará al reconectar.', 'warning');
        resetTrasladoForm();
        loadQueue();
      }
    } else {
      await saveOfflineItem({
        type: 'TRASLADO',
        endpoint: '/traslados',
        payload,
        label: `Traslado Patente ${payload.patente_vehiculo} (OT ${payload.ot_id})`
      });
      showToast && showToast('📦 Registro de Kilometraje guardado localmente en el celular (Modo Offline).', 'info');
      resetTrasladoForm();
      loadQueue();
    }
  };

  const resetTrasladoForm = () => {
    setTraslado({
      ot_id: '',
      trabajador_id: '',
      fecha: new Date().toISOString().split('T')[0],
      patente_vehiculo: '',
      km_inicio: '',
      km_termino: '',
      hora_salida_taller: '',
      hora_llegada_faena: '',
      hora_salida_faena: '',
      hora_llegada_taller: '',
      detalle_viaje: ''
    });
  };

  // --- SUBMIT GASTO Y FOTO ---
  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setGasto(prev => ({ ...prev, foto_boleta: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitGasto = async (e) => {
    e.preventDefault();
    if (!gasto.ot_id || !gasto.detalle || !gasto.valor_neto) {
      showToast && showToast('Por favor, selecciona OT, detalle y valor neto.', 'warning');
      return;
    }

    if (isLockedOt(gasto.ot_id)) {
      showToast && showToast('🔒 La OT seleccionada se encuentra Liquidada / Facturada / Cerrada. No permite nuevos ingresos.', 'danger');
      return;
    }

    const net = parseFloat(gasto.valor_neto) || 0;
    const iva = gasto.valor_iva !== '' ? parseFloat(gasto.valor_iva) : net * 0.19;
    const total = gasto.valor_total !== '' ? parseFloat(gasto.valor_total) : net + iva;

    const payload = {
      ...gasto,
      cantidad: parseFloat(gasto.cantidad) || 1,
      valor_neto: net,
      valor_iva: iva,
      valor_total: total
    };

    if (navigator.onLine) {
      try {
        await api('/gastos', { method: 'POST', body: JSON.stringify(payload) });
        showToast && showToast('💵 Gasto y Foto registrados exitosamente', 'success');
        resetGastoForm();
      } catch (err) {
        await saveOfflineItem({
          type: 'GASTO',
          endpoint: '/gastos',
          payload,
          label: `Gasto ${payload.clasificacion}: $${total.toLocaleString('es-CL')} (OT ${payload.ot_id})`
        });
        showToast && showToast('Gasto guardado en cola local (Offline).', 'warning');
        resetGastoForm();
        loadQueue();
      }
    } else {
      await saveOfflineItem({
        type: 'GASTO',
        endpoint: '/gastos',
        payload,
        label: `Gasto ${payload.clasificacion}: $${total.toLocaleString('es-CL')} (OT ${payload.ot_id})`
      });
      showToast && showToast('📦 Gasto guardado localmente en el celular (Modo Offline).', 'info');
      resetGastoForm();
      loadQueue();
    }
  };

  const resetGastoForm = () => {
    setGasto({
      ot_id: '',
      fecha: new Date().toISOString().split('T')[0],
      clasificacion: 'Combustible',
      detalle: '',
      cantidad: 1,
      valor_neto: '',
      valor_iva: '',
      valor_total: '',
      foto_boleta: null
    });
  };

  // --- SUBMIT HH ---
  const handleSubmitHh = async (e) => {
    e.preventDefault();
    if (!hh.ot_id || !hh.trabajador_id) {
      showToast && showToast('Selecciona OT y Trabajador', 'warning');
      return;
    }

    if (isLockedOt(hh.ot_id)) {
      showToast && showToast('🔒 La OT seleccionada se encuentra Liquidada / Facturada / Cerrada. No permite nuevos ingresos.', 'danger');
      return;
    }

    const payload = {
      ...hh,
      horas_normales: parseFloat(hh.horas_normales) || 0,
      horas_extra: parseFloat(hh.horas_extra) || 0
    };

    if (navigator.onLine) {
      try {
        await api('/hh', { method: 'POST', body: JSON.stringify(payload) });
        showToast && showToast('⏱️ Horas imputadas correctamente', 'success');
        resetHhForm();
      } catch (err) {
        await saveOfflineItem({
          type: 'HH',
          endpoint: '/hh',
          payload,
          label: `Imputación HH (${payload.horas_normales}h) - OT ${payload.ot_id}`
        });
        showToast && showToast('Imputación guardada en cola local.', 'warning');
        resetHhForm();
        loadQueue();
      }
    } else {
      await saveOfflineItem({
        type: 'HH',
        endpoint: '/hh',
        payload,
        label: `Imputación HH (${payload.horas_normales}h) - OT ${payload.ot_id}`
      });
      showToast && showToast('📦 HH guardadas localmente (Modo Offline).', 'info');
      resetHhForm();
      loadQueue();
    }
  };

  const resetHhForm = () => {
    setHh({
      ot_id: '',
      trabajador_id: '',
      fecha: new Date().toISOString().split('T')[0],
      horas_normales: 8,
      horas_extra: 0,
      ubicacion: 'Terreno',
      actividad: ''
    });
  };

  const handleRemoveQueueItem = async (id) => {
    await removeOfflineItem(id);
    loadQueue();
    showToast && showToast('Registro eliminado de la cola offline', 'info');
  };

  const calculatedKmTotal = (parseFloat(traslado.km_termino) || 0) - (parseFloat(traslado.km_inicio) || 0);

  return (
    <div className="dashboard-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Banner de Estado de Conexión y Sync */}
      <div style={{
        backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
        border: `1px solid ${isOnline ? '#10b981' : '#ef4444'}`,
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>{isOnline ? '🟢' : '🔴'}</span>
          <div>
            <strong style={{ color: isOnline ? '#10b981' : '#ef4444', fontSize: '0.9rem' }}>
              {isOnline ? 'SISTEMA ONLINE (Conectado)' : 'MODO OFFLINE ACTIVADO (Sin Cobertura)'}
            </strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {pendingQueue.length > 0 
                ? `📋 ${pendingQueue.length} registro(s) pendiente(s) por enviar`
                : 'Todos los registros sincronizados con la base de datos central.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {pendingQueue.length > 0 && isOnline && (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={handleSyncQueue} 
              disabled={syncing}
              style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
            >
              {syncing ? '⚡ Sincronizando...' : `⚡ Sincronizar Cola (${pendingQueue.length})`}
            </button>
          )}
          {onBack && (
            <button className="btn btn-secondary btn-sm" onClick={onBack}>
              ← Volver
            </button>
          )}
        </div>
      </div>

      {syncStatusMsg && (
        <div style={{ padding: '0.5rem', marginBottom: '1rem', backgroundColor: '#1e293b', borderRadius: '6px', fontSize: '0.8rem', textAlign: 'center', color: '#38bdf8' }}>
          {syncStatusMsg}
        </div>
      )}

      {/* Selector de Sub-Módulos Táctiles */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        <button 
          className={`btn ${activeTab === 'traslados' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ flex: 1, minWidth: '120px', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('traslados')}
        >
          🚗 Kilometraje
        </button>
        <button 
          className={`btn ${activeTab === 'gastos' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ flex: 1, minWidth: '120px', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('gastos')}
        >
          📷 Gastos & Fotos
        </button>
        <button 
          className={`btn ${activeTab === 'hh' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ flex: 1, minWidth: '110px', whiteSpace: 'nowrap' }}
          onClick={() => setActiveTab('hh')}
        >
          ⏱️ HH Terreno
        </button>
        <button 
          className={`btn ${activeTab === 'cola' ? 'btn-primary' : 'btn-secondary'}`} 
          style={{ flex: 1, minWidth: '110px', whiteSpace: 'nowrap', position: 'relative' }}
          onClick={() => setActiveTab('cola')}
        >
          📋 Cola ({pendingQueue.length})
        </button>
      </div>

      {/* --- PESTAÑA 1: KILOMETRAJE Y TRASLADOS --- */}
      {activeTab === 'traslados' && (
        <div className="panel-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🚗 Registro de Kilometraje y Traslados
          </h3>
          <form onSubmit={handleSubmitTraslado}>
            <div className="form-group">
              <label>Orden de Trabajo (OT) *</label>
              <select 
                className="form-control" 
                value={traslado.ot_id} 
                onChange={(e) => setTraslado({ ...traslado, ot_id: e.target.value })} 
                required
              >
                <option value="">-- Seleccionar OT --</option>
                {ots.map(o => (
                  <option key={o.id} value={o.id}>OT {o.id} - {o.cliente_nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Conductor / Técnico *</label>
                <select 
                  className="form-control" 
                  value={traslado.trabajador_id} 
                  onChange={(e) => setTraslado({ ...traslado, trabajador_id: e.target.value })} 
                  required
                >
                  <option value="">-- Seleccionar Conductor --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Patente del Vehículo *</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: ABCD-12" 
                  value={traslado.patente_vehiculo} 
                  onChange={(e) => setTraslado({ ...traslado, patente_vehiculo: e.target.value.toUpperCase() })} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Fecha</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={traslado.fecha} 
                  onChange={(e) => setTraslado({ ...traslado, fecha: e.target.value })} 
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', backgroundColor: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '6px', margin: '1rem 0' }}>
              <div className="form-group">
                <label>Km Inicial (Salida Taller)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Ej: 120500" 
                  value={traslado.km_inicio} 
                  onChange={(e) => setTraslado({ ...traslado, km_inicio: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label>Km Final (Retorno Taller)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Ej: 120650" 
                  value={traslado.km_termino} 
                  onChange={(e) => setTraslado({ ...traslado, km_termino: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label>Total Km Recorridos</label>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: calculatedKmTotal >= 0 ? '#10b981' : '#ef4444', paddingTop: '0.4rem' }}>
                  {calculatedKmTotal >= 0 ? `${calculatedKmTotal.toLocaleString('es-CL')} Km` : '0 Km'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem' }}>Salida Taller</label>
                <input type="time" className="form-control" value={traslado.hora_salida_taller} onChange={(e) => setTraslado({ ...traslado, hora_salida_taller: e.target.value })} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem' }}>Llegada Faena</label>
                <input type="time" className="form-control" value={traslado.hora_llegada_faena} onChange={(e) => setTraslado({ ...traslado, hora_llegada_faena: e.target.value })} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem' }}>Salida Faena</label>
                <input type="time" className="form-control" value={traslado.hora_salida_faena} onChange={(e) => setTraslado({ ...traslado, hora_salida_faena: e.target.value })} />
              </div>
              <div className="form-group">
                <label style={{ fontSize: '0.75rem' }}>Llegada Taller</label>
                <input type="time" className="form-control" value={traslado.hora_llegada_taller} onChange={(e) => setTraslado({ ...traslado, hora_llegada_taller: e.target.value })} />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Detalle / Motivo del Traslado</label>
              <textarea 
                className="form-control" 
                rows="2" 
                placeholder="Ej: Traslado de herramientas y equipo de soldadura hacia faena Molino" 
                value={traslado.detalle_viaje} 
                onChange={(e) => setTraslado({ ...traslado, detalle_viaje: e.target.value })}
              ></textarea>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontSize: '1rem' }}>
              🚗 Registrar Traslado {isOnline ? '' : '(Guardar Offline)'}
            </button>
          </form>
        </div>
      )}

      {/* --- PESTAÑA 2: GASTOS Y FOTOS --- */}
      {activeTab === 'gastos' && (
        <div className="panel-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            📷 Rendición de Gastos y Captura de Fotos
          </h3>
          <form onSubmit={handleSubmitGasto}>
            <div className="form-group">
              <label>Orden de Trabajo (OT) *</label>
              <select 
                className="form-control" 
                value={gasto.ot_id} 
                onChange={(e) => setGasto({ ...gasto, ot_id: e.target.value })} 
                required
              >
                <option value="">-- Seleccionar OT --</option>
                {ots.map(o => (
                  <option key={o.id} value={o.id}>OT {o.id} - {o.cliente_nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Clasificación del Gasto *</label>
                <select 
                  className="form-control" 
                  value={gasto.clasificacion} 
                  onChange={(e) => setGasto({ ...gasto, clasificacion: e.target.value })}
                >
                  <option value="Combustible">⛽ Combustible</option>
                  <option value="Peaje">🛣️ Peaje</option>
                  <option value="Almuerzo">🍲 Almuerzo / Colación</option>
                  <option value="INSUMOS">🛠️ Insumos / Repuestos</option>
                  <option value="Plotteo">📄 Plotteo / Planos</option>
                  <option value="Otros">📝 Otros Gastos</option>
                </select>
              </div>

              <div className="form-group">
                <label>Fecha *</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={gasto.fecha} 
                  onChange={(e) => setGasto({ ...gasto, fecha: e.target.value })} 
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label>Detalle / Descripción del Gasto *</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Ej: Carga combustible camioneta patente ABCD-12" 
                value={gasto.detalle} 
                onChange={(e) => setGasto({ ...gasto, detalle: e.target.value })} 
                required 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Valor Neto ($) *</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Ej: 25000" 
                  value={gasto.valor_neto} 
                  onChange={(e) => setGasto({ ...gasto, valor_neto: e.target.value })} 
                  required 
                />
              </div>

              <div className="form-group">
                <label>Valor IVA ($)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Auto (19%)" 
                  value={gasto.valor_iva} 
                  onChange={(e) => setGasto({ ...gasto, valor_iva: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label>Valor Total ($)</label>
                <input 
                  type="number" 
                  className="form-control" 
                  placeholder="Auto (Neto + IVA)" 
                  value={gasto.valor_total} 
                  onChange={(e) => setGasto({ ...gasto, valor_total: e.target.value })} 
                />
              </div>
            </div>

            {/* SECCIÓN DE CAPTURA DE FOTO */}
            <div style={{ border: '2px dashed var(--panel-border)', borderRadius: '8px', padding: '1rem', marginTop: '1rem', textAlign: 'center' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem' }}>
                📷 Capturar Foto de Boleta / Factura / Trabajo
              </label>
              
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                ref={cameraInputRef} 
                style={{ display: 'none' }} 
                onChange={handlePhotoCapture} 
              />

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  📷 Abrir Cámara del Celular
                </button>
              </div>

              {gasto.foto_boleta && (
                <div style={{ marginTop: '1rem' }}>
                  <p style={{ fontSize: '0.8rem', color: '#10b981', margin: '0 0 0.5rem 0' }}>✓ Foto adjuntada con éxito:</p>
                  <img 
                    src={gasto.foto_boleta} 
                    alt="Previsualización de Foto" 
                    style={{ maxHeight: '180px', borderRadius: '6px', border: '1px solid var(--panel-border)' }} 
                  />
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => setGasto({ ...gasto, foto_boleta: null })} 
                    style={{ display: 'block', margin: '0.5rem auto 0 auto', color: '#ef4444' }}
                  >
                    Quitar Foto
                  </button>
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontSize: '1rem' }}>
              💵 Registrar Gasto y Foto {isOnline ? '' : '(Guardar Offline)'}
            </button>
          </form>
        </div>
      )}

      {/* --- PESTAÑA 3: HH TERRENO --- */}
      {activeTab === 'hh' && (
        <div className="panel-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            ⏱️ Imputación Rápida de HH Terreno
          </h3>
          <form onSubmit={handleSubmitHh}>
            <div className="form-group">
              <label>Orden de Trabajo (OT) *</label>
              <select 
                className="form-control" 
                value={hh.ot_id} 
                onChange={(e) => setHh({ ...hh, ot_id: e.target.value })} 
                required
              >
                <option value="">-- Seleccionar OT --</option>
                {ots.map(o => (
                  <option key={o.id} value={o.id}>OT {o.id} - {o.cliente_nombre}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Trabajador / Operador *</label>
                <select 
                  className="form-control" 
                  value={hh.trabajador_id} 
                  onChange={(e) => setHh({ ...hh, trabajador_id: e.target.value })} 
                  required
                >
                  <option value="">-- Seleccionar Trabajador --</option>
                  {workers.map(w => (
                    <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Fecha *</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={hh.fecha} 
                  onChange={(e) => setHh({ ...hh, fecha: e.target.value })} 
                  required 
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label>Horas Normales</label>
                <input 
                  type="number" 
                  step="0.5" 
                  className="form-control" 
                  value={hh.horas_normales} 
                  onChange={(e) => setHh({ ...hh, horas_normales: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label>Horas Extras</label>
                <input 
                  type="number" 
                  step="0.5" 
                  className="form-control" 
                  value={hh.horas_extra} 
                  onChange={(e) => setHh({ ...hh, horas_extra: e.target.value })} 
                />
              </div>

              <div className="form-group">
                <label>Ubicación</label>
                <select 
                  className="form-control" 
                  value={hh.ubicacion} 
                  onChange={(e) => setHh({ ...hh, ubicacion: e.target.value })}
                >
                  <option value="Terreno">🏗️ Terreno / Faena</option>
                  <option value="Taller">🏭 Taller Maestranza</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Actividad Realizada</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Ej: Montaje estructural y alineación de buje" 
                value={hh.actividad} 
                onChange={(e) => setHh({ ...hh, actividad: e.target.value })} 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontSize: '1rem' }}>
              ⏱️ Imputar Horas Hombre {isOnline ? '' : '(Guardar Offline)'}
            </button>
          </form>
        </div>
      )}

      {/* --- PESTAÑA 4: COLA PENDIENTE OFFLINE --- */}
      {activeTab === 'cola' && (
        <div className="panel-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>📋 Cola Pendiente de Sincronización Local</h3>
            {pendingQueue.length > 0 && isOnline && (
              <button className="btn btn-primary btn-sm" onClick={handleSyncQueue} disabled={syncing}>
                {syncing ? 'Enviando...' : '⚡ Sincronizar Todo'}
              </button>
            )}
          </div>

          {pendingQueue.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
              🎉 No hay registros pendientes en el celular. Todo se encuentra al día en la base de datos central.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {pendingQueue.map((item) => (
                <div 
                  key={item.id} 
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--panel-border)',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div>
                    <span className="badge" style={{ backgroundColor: '#38bdf8', color: '#000', marginRight: '0.5rem', fontWeight: 600 }}>
                      {item.type}
                    </span>
                    <strong style={{ fontSize: '0.9rem' }}>{item.label}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Guardado localmente el {new Date(item.timestamp).toLocaleString('es-CL')}
                    </div>
                  </div>

                  <button 
                    className="btn btn-danger btn-sm" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} 
                    onClick={() => handleRemoveQueueItem(item.id)}
                    title="Descartar de la cola"
                  >
                    🗑️ Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default ModuloTerrenoOffline;

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
  const [activeTabAdmin, setActiveTabAdmin] = useState('ots'); // 'ots', 'rendimiento', 'inventario', 'activos', 'cotizaciones'
  const [performanceData, setPerformanceData] = useState([]);
  const [selectedWorkerForDetail, setSelectedWorkerForDetail] = useState(null);
  const [workerDetailHhList, setWorkerDetailHhList] = useState([]);
  const [loadingWorkerDetail, setLoadingWorkerDetail] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [selectedUserIdToEdit, setSelectedUserIdToEdit] = useState('');
  const [newUserProfile, setNewUserProfile] = useState({ nombre: '', email: '', password: '', rol: 'supervisor' });

  // Inventario States
  const [inventario, setInventario] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [newItem, setNewItem] = useState({ sku: '', descripcion: '', proveedor: '', stock: 0, ubicacion: '', valor_unitario: 0 });
  const [showMovModal, setShowMovModal] = useState(false);
  const [newMov, setNewMov] = useState({ tipo: 'ENTRADA', sku: '', fecha: new Date().toISOString().split('T')[0], cantidad: 0, valor_unitario: 0, factura_num: '', proveedor_o_cliente: '', ot_id: '' });

  // Activos States
  const [activos, setActivos] = useState([]);
  const [showActivoModal, setShowActivoModal] = useState(false);
  const [newActivo, setNewActivo] = useState({ nombre: '', descripcion: '', tipo: '', ubicacion: '', proveedor: '', valor_compra: 0, garantia_vencimiento: '', condicion: 'Bueno', cantidad: 1, modelo: '', observaciones: '' });
  const [showAsignarModal, setShowAsignarModal] = useState(false);
  const [selectedActivoToAssign, setSelectedActivoToAssign] = useState(null);
  const [asignarForm, setAsignarForm] = useState({ trabajador_id: '', ot_id: '' });

  // Cotizaciones States
  const [cotizaciones, setCotizaciones] = useState([]);
  const [showCotModal, setShowCotModal] = useState(false);
  const [newCot, setNewCot] = useState({ cliente_id: '', detalle: '', hh_estimadas: [], materiales_estimados: [], terceros_estimados: 0, utilidad_porcentaje: 25 });
  const [cotHhInput, setCotHhInput] = useState({ rol: 'Supervisor', horas: 0, valor_hh: 12000 });
  const [cotMatInput, setCotMatInput] = useState({ sku: '', cantidad: 0, valor_unitario: 0 });

  // Custom Modal States (replace window.prompt/confirm)
  const [showAprobarModal, setShowAprobarModal] = useState(false);
  const [aprobarCotId, setAprobarCotId] = useState(null);
  const [aprobarOtIdInput, setAprobarOtIdInput] = useState('');
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });
  const [showPrintCotModal, setShowPrintCotModal] = useState(false);
  const [selectedCotToPrint, setSelectedCotToPrint] = useState(null);

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

  const fetchActivos = async () => {
    try {
      const acts = await api('/activos');
      setActivos(acts);
    } catch (err) {
      showToast('Error al cargar activos', 'danger');
    }
  };

  const fetchCotizaciones = async () => {
    try {
      const cots = await api('/cotizaciones');
      setCotizaciones(cots);
    } catch (err) {
      showToast('Error al cargar cotizaciones', 'danger');
    }
  };

  const handleSaveItem = async (e) => {
    e.preventDefault();
    try {
      await api('/inventario', {
        method: 'POST',
        body: JSON.stringify(newItem)
      });
      showToast('Consumible registrado con éxito', 'success');
      setShowItemModal(false);
      fetchInventario();
    } catch (err) {
      showToast('Error al guardar consumible', 'danger');
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

  const handleSaveActivo = async (e) => {
    e.preventDefault();
    try {
      await api('/activos', {
        method: 'POST',
        body: JSON.stringify(newActivo)
      });
      showToast('Activo registrado con éxito', 'success');
      setShowActivoModal(false);
      fetchActivos();
    } catch (err) {
      showToast('Error al registrar activo', 'danger');
    }
  };

  const handleAsignarActivo = async (e) => {
    e.preventDefault();
    try {
      await api(`/activos/${selectedActivoToAssign.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...selectedActivoToAssign,
          asignado_a_trabajador_id: asignarForm.trabajador_id || null,
          asignado_a_ot_id: asignarForm.ot_id || null
        })
      });
      showToast('Activo asignado con éxito', 'success');
      setShowAsignarModal(false);
      fetchActivos();
    } catch (err) {
      showToast('Error al asignar activo', 'danger');
    }
  };

  const handleAddHhCot = () => {
    if (!cotHhInput.horas || cotHhInput.horas <= 0) return;
    setNewCot({
      ...newCot,
      hh_estimadas: [...(newCot.hh_estimadas || []), { ...cotHhInput }]
    });
    setCotHhInput({ rol: 'Supervisor', horas: 0, valor_hh: 12000 });
  };

  const handleRemoveHhCot = (index) => {
    const list = [...(newCot.hh_estimadas || [])];
    list.splice(index, 1);
    setNewCot({ ...newCot, hh_estimadas: list });
  };

  const handleAddMatCot = () => {
    if (!cotMatInput.sku || !cotMatInput.cantidad || cotMatInput.cantidad <= 0) return;
    const invItem = inventario.find(i => i.sku === cotMatInput.sku);
    setNewCot({
      ...newCot,
      materiales_estimados: [
        ...(newCot.materiales_estimados || []),
        {
          sku: cotMatInput.sku,
          descripcion: invItem ? invItem.descripcion : 'Insumo',
          cantidad: parseFloat(cotMatInput.cantidad),
          valor_unitario: parseFloat(cotMatInput.valor_unitario)
        }
      ]
    });
    setCotMatInput({ sku: '', cantidad: 0, valor_unitario: 0 });
  };

  const handleRemoveMatCot = (index) => {
    const list = [...(newCot.materiales_estimados || [])];
    list.splice(index, 1);
    setNewCot({ ...newCot, materiales_estimados: list });
  };

  const calculateCotTotals = () => {
    const subtotalHh = (newCot.hh_estimadas || []).reduce((sum, h) => sum + (h.horas * h.valor_hh), 0);
    const subtotalMat = (newCot.materiales_estimados || []).reduce((sum, m) => sum + (m.cantidad * m.valor_unitario), 0);
    const subtotalTerceros = parseFloat(newCot.terceros_estimados) || 0;
    const costoSubtotal = subtotalHh + subtotalMat + subtotalTerceros;
    const utilidadMonto = costoSubtotal * ((parseFloat(newCot.utilidad_porcentaje) || 25) / 100);
    const neto = costoSubtotal + utilidadMonto;
    const iva = neto * 0.19;
    const total = neto + iva;
    return { subtotalHh, subtotalMat, costoSubtotal, neto, iva, total };
  };

  const handleSaveCotizacion = async (e) => {
    e.preventDefault();
    const totals = calculateCotTotals();
    const payload = {
      ...newCot,
      monto_neto_presupuesto: totals.neto
    };
    try {
      await api('/cotizaciones', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      showToast('Cotización guardada con éxito', 'success');
      setShowCotModal(false);
      fetchCotizaciones();
    } catch (err) {
      showToast('Error al guardar cotización', 'danger');
    }
  };

  const handleAprobarCotizacion = (cotId) => {
    const suggested = `OT-${Math.floor(1000 + Math.random() * 9000)}`;
    setAprobarCotId(cotId);
    setAprobarOtIdInput(suggested);
    setShowAprobarModal(true);
  };

  const handleConfirmAprobar = async () => {
    if (!aprobarOtIdInput.trim()) {
      showToast('Debes ingresar un número de OT', 'warning');
      return;
    }
    try {
      await api(`/cotizaciones/${aprobarCotId}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ estado: 'APROBADA', ot_id: aprobarOtIdInput.trim() })
      });
      showToast(`Cotización aprobada y OT ${aprobarOtIdInput.trim()} creada`, 'success');
      setShowAprobarModal(false);
      fetchCotizaciones();
      fetchData();
    } catch (err) {
      showToast('Error al aprobar cotización', 'danger');
    }
  };

  const fetchPerformance = async () => {
    try {
      const data = await api('/finanzas/rendimiento-personal');
      setPerformanceData(data);
    } catch (err) {
      showToast('Error al cargar rendimiento de personal', 'danger');
    }
  };

  const handleViewWorkerDetail = async (worker) => {
    setSelectedWorkerForDetail(worker);
    setLoadingWorkerDetail(true);
    try {
      const allHh = await api('/hh');
      const currentMonth = new Date().toISOString().substring(0, 7); // ej: "2026-07"
      const filtered = allHh.filter(h => h.trabajador_id === worker.id && h.fecha.startsWith(currentMonth));
      setWorkerDetailHhList(filtered);
    } catch (err) {
      showToast('Error al cargar detalle de horas del trabajador', 'danger');
    } finally {
      setLoadingWorkerDetail(false);
    }
  };

  const handleOpenUserModal = async () => {
    setShowUserModal(true);
    setSelectedUserIdToEdit('');
    setNewUserProfile({ nombre: '', email: '', password: '', rol: 'supervisor' });
    try {
      const data = await api('/usuarios');
      setUsersList(data);
    } catch (err) {
      showToast('Error al cargar la lista de usuarios', 'danger');
    }
  };

  const handleUserSelectChange = (userId) => {
    setSelectedUserIdToEdit(userId);
    if (userId === '') {
      setNewUserProfile({ nombre: '', email: '', password: '', rol: 'supervisor' });
    } else {
      const selected = usersList.find(u => u.id === parseInt(userId));
      if (selected) {
        setNewUserProfile({
          nombre: selected.nombre || '',
          email: selected.email || '',
          password: '',
          rol: selected.rol || 'supervisor'
        });
      }
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (selectedUserIdToEdit === '') {
        await api('/usuarios', {
          method: 'POST',
          body: JSON.stringify(newUserProfile)
        });
        showToast('Perfil de usuario creado con éxito', 'success');
      } else {
        await api(`/usuarios/${selectedUserIdToEdit}`, {
          method: 'PUT',
          body: JSON.stringify(newUserProfile)
        });
        showToast('Perfil de usuario actualizado con éxito', 'success');
      }
      setShowUserModal(false);
    } catch (err) {
      showToast(err.message || 'Error al guardar usuario', 'danger');
    }
  };

  const handleDeleteUser = (userId) => {
    setConfirmModal({
      show: true,
      message: '¿Estás seguro de que deseas eliminar este perfil de usuario? Ya no podrá iniciar sesión.',
      onConfirm: async () => {
        try {
          await api(`/usuarios/${userId}`, { method: 'DELETE' });
          showToast('Perfil de usuario eliminado', 'success');
          setShowUserModal(false);
        } catch (err) {
          showToast(err.message || 'Error al eliminar usuario', 'danger');
        }
        setConfirmModal({ show: false, message: '', onConfirm: null });
      }
    });
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
    } else if (activeTabAdmin === 'rendimiento') {
      document.title = 'Trimec - Rendimiento de Personal';
      fetchPerformance();
    } else if (activeTabAdmin === 'inventario') {
      document.title = 'Trimec - Inventario de Consumibles';
      fetchInventario();
    } else if (activeTabAdmin === 'activos') {
      document.title = 'Trimec - Activos y Herramientas';
      fetchActivos();
    } else if (activeTabAdmin === 'cotizaciones') {
      document.title = 'Trimec - Presupuestos y Cotizaciones';
      fetchCotizaciones();
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

  const handleDeleteWorker = (workerId) => {
    setConfirmModal({
      show: true,
      message: '¿Estás seguro de que deseas eliminar a esta persona? Esto no borrará sus registros de HH históricos pero no aparecerá más en los listados activos.',
      onConfirm: async () => {
        try {
          await api(`/trabajadores/${workerId}`, { method: 'DELETE' });
          showToast('Trabajador eliminado con éxito', 'success');
          setShowWorkerModal(false);
          setSelectedWorker(null);
          fetchData();
        } catch (err) {
          showToast(err.message, 'danger');
        }
        setConfirmModal({ show: false, message: '', onConfirm: null });
      }
    });
  };

  // KPIs
  const totalRevenue = ots.reduce((acc, curr) => acc + (parseFloat(curr.monto_neto_presupuesto) || 0), 0);
  const totalCost = ots.reduce((acc, curr) => acc + (parseFloat(curr.costo_total) || 0), 0);
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
          <button className="btn btn-secondary" onClick={handleOpenUserModal}>👥 Gestionar Usuarios</button>
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
          <div className="kpi-value notranslate">${Math.round(totalRevenue).toLocaleString('es-CL')}</div>
        </div>
        <div className="kpi-card warning">
          <div className="kpi-label">Costo Total Acumulado (HH + Gastos)</div>
          <div className="kpi-value notranslate">${Math.round(totalCost).toLocaleString('es-CL')}</div>
        </div>
        <div className="kpi-card success">
          <div className="kpi-label">Margen Operativo Bruto</div>
          <div className="kpi-value notranslate" style={{ color: totalProfit >= 0 ? '#34d399' : '#f87171' }}>
            ${Math.round(totalProfit).toLocaleString('es-CL')}
          </div>
        </div>
        <div className="kpi-card purple">
          <div className="kpi-label">Margen Porcentual Promedio</div>
          <div className="kpi-value notranslate" style={{ color: avgMargin >= 25 ? '#34d399' : avgMargin >= 0 ? '#fbbf24' : '#f87171' }}>
            {avgMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="tab-bar" style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className={`tab-btn ${activeTabAdmin === 'ots' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('ots')}>
          📋 OTs y Tarifas
        </button>
        <button className={`tab-btn ${activeTabAdmin === 'rendimiento' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('rendimiento')}>
          📊 Rendimiento Personal
        </button>
        <button className={`tab-btn ${activeTabAdmin === 'inventario' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('inventario')}>
          📦 Inventario Consumibles
        </button>
        <button className={`tab-btn ${activeTabAdmin === 'activos' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('activos')}>
          ⚙️ Equipos y Activos
        </button>
        <button className={`tab-btn ${activeTabAdmin === 'cotizaciones' ? 'active' : ''}`} onClick={() => setActiveTabAdmin('cotizaciones')}>
          💼 Presupuestos y Cotizaciones
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
                      <td className="text-right notranslate">${Math.round(ot.monto_neto_presupuesto).toLocaleString('es-CL')}</td>
                      <td className="text-right notranslate">${Math.round(ot.costo_total).toLocaleString('es-CL')}</td>
                      <td className="text-right notranslate">
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
                    <div 
                      key={perf.id} 
                      onClick={() => handleViewWorkerDetail(perf)}
                      className="worker-card-hover"
                      style={{ 
                        background: 'rgba(255, 255, 255, 0.02)', 
                        border: '1px solid var(--panel-border)', 
                        padding: '1.25rem', 
                        borderRadius: '1.15rem',
                        cursor: 'pointer'
                      }}
                    >
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

          {/* TAB 3: INVENTARIO */}
          {activeTabAdmin === 'inventario' && (
            <div className="dashboard-layout">
              {/* Inventario List */}
              <div className="panel-card">
                <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3>Inventario de Consumibles y Repuestos</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Existencias y costos unitarios registrados
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setNewItem({ sku: '', descripcion: '', proveedor: '', stock: 0, ubicacion: '', valor_unitario: 0 }); setShowItemModal(true); }}>
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
                        <th>Proveedor</th>
                        <th>Ubicación</th>
                        <th>Stock</th>
                        <th>Costo Unitario</th>
                        <th>Valor Total Stock</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventario.map(item => (
                        <tr key={item.sku}>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.sku}</td>
                          <td>{item.descripcion}</td>
                          <td>{item.proveedor || '-'}</td>
                          <td>{item.ubicacion || '-'}</td>
                          <td>
                            <span className={`badge ${item.stock <= 2 ? 'badge-emergencia' : 'badge-aprobada'}`}>
                              {item.stock} unidades
                            </span>
                          </td>
                          <td className="text-right notranslate">${Math.round(item.valor_unitario).toLocaleString('es-CL')}</td>
                          <td className="text-right notranslate" style={{ fontWeight: 600 }}>${Math.round(item.stock * item.valor_unitario).toLocaleString('es-CL')}</td>
                          <td>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => { setNewItem(item); setShowItemModal(true); }}>
                              ✏️
                            </button>
                          </td>
                        </tr>
                      ))}
                      {inventario.length === 0 && (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            No hay artículos registrados en el inventario.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Movimientos Históricos */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Log de Movimientos</h3>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Últimos registros</span>
                </div>
                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>SKU</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        <th>Factura</th>
                        <th>OT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map(m => (
                        <tr key={m.id}>
                          <td>{m.fecha}</td>
                          <td style={{ fontWeight: 600 }}>{m.sku}</td>
                          <td>
                            <span className={`badge ${m.tipo === 'ENTRADA' ? 'badge-aprobada' : 'badge-emergencia'}`}>
                              {m.tipo}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{m.cantidad}</td>
                          <td>{m.factura_num || '-'}</td>
                          <td style={{ color: 'var(--primary)', fontWeight: 600 }}>{m.ot_id || '-'}</td>
                        </tr>
                      ))}
                      {movimientos.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            No hay movimientos registrados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EQUIPOS Y ACTIVOS */}
          {activeTabAdmin === 'activos' && (
            <div className="dashboard-layout" style={{ gridTemplateColumns: '1fr' }}>
              <div className="panel-card">
                <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3>Control de Equipos, Maquinarias y Activos</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Trazabilidad, garantías y asignación de activos de la Maestranza
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setNewActivo({ nombre: '', descripcion: '', tipo: '', ubicacion: '', proveedor: '', valor_compra: 0, garantia_vencimiento: '', condicion: 'Bueno', cantidad: 1, modelo: '', observaciones: '' }); setShowActivoModal(true); }}>
                    + Registrar Activo
                  </button>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Nombre / Modelo</th>
                        <th>Descripción</th>
                        <th>Ubicación</th>
                        <th>Condición</th>
                        <th>Proveedor</th>
                        <th>Valor Compra</th>
                        <th>Garantía Vence</th>
                        <th>Asignado A</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activos.map(act => (
                        <tr key={act.id}>
                          <td style={{ fontWeight: 700 }}>
                            {act.nombre}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Mod: {act.modelo || 'S/M'}</div>
                          </td>
                          <td>{act.descripcion || '-'}</td>
                          <td>{act.ubicacion || '-'}</td>
                          <td>
                            <span className={`badge ${act.condicion === 'Nuevo' ? 'badge-aprobada' : act.condicion === 'Bueno' ? 'badge-proceso' : 'badge-emergencia'}`}>
                              {act.condicion}
                            </span>
                          </td>
                          <td>{act.proveedor || '-'}</td>
                          <td className="text-right notranslate">${Math.round(act.valor_compra).toLocaleString('es-CL')}</td>
                          <td>{act.garantia_vencimiento || '-'}</td>
                          <td>
                            {act.asignado_nombre ? (
                              <div style={{ fontWeight: 600, color: 'var(--success)' }}>👷 {act.asignado_nombre}</div>
                            ) : act.asignado_a_ot_id ? (
                              <div style={{ fontWeight: 600, color: 'var(--primary)' }}>📋 OT {act.asignado_a_ot_id}</div>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No asignado</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} title="Editar Activo" onClick={() => { setNewActivo(act); setShowActivoModal(true); }}>
                                ✏️
                              </button>
                              <button className="btn btn-primary btn-sm" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }} title="Asignar" onClick={() => { setSelectedActivoToAssign(act); setAsignarForm({ trabajador_id: act.asignado_a_trabajador_id || '', ot_id: act.asignado_a_ot_id || '' }); setShowAsignarModal(true); }}>
                                👷/📋
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {activos.length === 0 && (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            No hay activos registrados en el sistema.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: COTIZACIONES */}
          {activeTabAdmin === 'cotizaciones' && (
            <div className="dashboard-layout" style={{ gridTemplateColumns: '1fr' }}>
              <div className="panel-card">
                <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
                  <div>
                    <h3>Presupuestos y Cotizaciones de Servicios</h3>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Costeo dinámico de HH y materiales para cotización comercial
                    </span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => { setNewCot({ cliente_id: '', detalle: '', hh_estimadas: [], materiales_estimados: [], terceros_estimados: 0, utilidad_porcentaje: 25 }); setShowCotModal(true); }}>
                    + Crear Cotización
                  </button>
                </div>

                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Nro Cot</th>
                        <th>Cliente</th>
                        <th>Detalle / Descripción</th>
                        <th>Fecha Creación</th>
                        <th>Monto Neto</th>
                        <th>Total (c/IVA)</th>
                        <th>Estado</th>
                        <th>OT Creada</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cotizaciones.map(cot => {
                        const net = cot.monto_neto_presupuesto || 0;
                        const total = net * 1.19;
                        return (
                          <tr key={cot.id}>
                            <td style={{ fontWeight: 700, color: 'var(--primary)' }}>COT-{cot.id}</td>
                            <td style={{ fontWeight: 600 }}>{cot.cliente_nombre}</td>
                            <td>{cot.detalle}</td>
                            <td>{cot.fecha_creacion}</td>
                            <td className="text-right notranslate">${Math.round(net).toLocaleString('es-CL')}</td>
                            <td className="text-right notranslate" style={{ fontWeight: 600 }}>${Math.round(total).toLocaleString('es-CL')}</td>
                            <td>
                              <span className={`badge badge-${cot.estado === 'APROBADA' ? 'aprobada' : cot.estado === 'RECHAZADA' ? 'emergencia' : 'proceso'}`}>
                                {cot.estado}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{cot.ot_creada_id || '-'}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedCotToPrint(cot); setShowPrintCotModal(true); }} title="Ver e Imprimir Cotización">
                                  🖨️ Ver / Imprimir
                                </button>
                                {cot.estado === 'CREADA' && (
                                  <button className="btn btn-primary btn-sm" onClick={() => handleAprobarCotizacion(cot.id)}>
                                    ✅ Aprobar y Abrir OT
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {cotizaciones.length === 0 && (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            No hay cotizaciones registradas en el sistema.
                          </td>
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

      {/* MODAL: DETALLE HORAS TRABAJADOR */}
      {selectedWorkerForDetail && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Detalle de Horas Hombre</h3>
                <p style={{ color: 'var(--text-secondary)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
                  <strong>{selectedWorkerForDetail.nombre}</strong> — {selectedWorkerForDetail.rol}
                </p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedWorkerForDetail(null)}>Cerrar</button>
            </div>

            {loadingWorkerDetail ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Cargando horas...</p>
            ) : (
              <div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', fontSize: '0.9rem' }}>
                  <span>Horas Normales: <strong>{workerDetailHhList.reduce((acc, h) => acc + h.horas_normales, 0)} hrs</strong></span>
                  <span>Horas Extra: <strong>{workerDetailHhList.reduce((acc, h) => acc + h.horas_extra, 0)} hrs</strong></span>
                  <span>Total Imputado: <strong>{selectedWorkerForDetail.horas_reales} hrs</strong></span>
                  <span>Meta Esperada: <strong>{selectedWorkerForDetail.horas_mensuales_esperadas} hrs</strong></span>
                </div>

                <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>OT</th>
                        <th>Ubicación</th>
                        <th>Horas Norm.</th>
                        <th>Horas Extra</th>
                        <th>Actividad / Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workerDetailHhList.map((hh) => (
                        <tr key={hh.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{hh.fecha}</td>
                          <td>
                            <strong style={{ color: 'var(--primary)' }}>OT {hh.ot_id}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={hh.ot_detalle}>
                              {hh.ot_detalle}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${hh.ubicacion === 'Taller' ? 'badge-proceso' : 'badge-aprobada'}`}>
                              {hh.ubicacion}
                            </span>
                          </td>
                          <td>{hh.horas_normales} hrs</td>
                          <td>{hh.horas_extra} hrs</td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {hh.actividad || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin descripción</span>}
                          </td>
                        </tr>
                      ))}
                      {workerDetailHhList.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            No hay registros de horas en el mes actual para este trabajador.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL: GESTIONAR USUARIOS DE ACCESO */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{selectedUserIdToEdit === '' ? 'Crear Nuevo Perfil' : 'Editar Perfil de Acceso'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowUserModal(false)}>Cerrar</button>
            </div>
            
            <div className="form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
              <label style={{ fontWeight: 600 }}>Seleccionar Perfil para Editar</label>
              <select className="form-control mt-2" value={selectedUserIdToEdit} onChange={(e) => handleUserSelectChange(e.target.value)}>
                <option value="">-- [ Nuevo Perfil / Cuenta ] --</option>
                {usersList.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
              </select>
            </div>

            <form onSubmit={handleSaveUser}>
              <div className="form-group">
                <label>Nombre del Usuario</label>
                <input type="text" className="form-control" placeholder="Ej: Angelo Muñoz V." value={newUserProfile.nombre} onChange={(e) => setNewUserProfile({ ...newUserProfile, nombre: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Correo Electrónico (Email de Acceso)</label>
                <input type="email" className="form-control" placeholder="Ej: angelo@trimec.cl" value={newUserProfile.email} onChange={(e) => setNewUserProfile({ ...newUserProfile, email: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Contraseña de Acceso</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder={selectedUserIdToEdit === '' ? 'Ingresar contraseña' : 'Dejar en blanco para no cambiar'} 
                  value={newUserProfile.password} 
                  onChange={(e) => setNewUserProfile({ ...newUserProfile, password: e.target.value })} 
                  required={selectedUserIdToEdit === ''} 
                />
              </div>
              <div className="form-group">
                <label>Rol / Permisos del Perfil</label>
                <select className="form-control" value={newUserProfile.rol} onChange={(e) => setNewUserProfile({ ...newUserProfile, rol: e.target.value })}>
                  <option value="admin">Administrador (Acceso Total)</option>
                  <option value="supervisor">Supervisor (Imputación HH y Gastos)</option>
                  <option value="contador">Contador (Control Financiero y Facturas)</option>
                </select>
              </div>
              
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                {selectedUserIdToEdit === '' ? 'Crear Perfil de Usuario' : 'Guardar Cambios'}
              </button>
              {selectedUserIdToEdit !== '' && (
                <button type="button" className="btn btn-danger" style={{ width: '100%', marginTop: '0.5rem' }} onClick={() => handleDeleteUser(selectedUserIdToEdit)}>
                  🗑️ Eliminar Perfil
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR/EDITAR ARTICULO DE INVENTARIO */}
      {showItemModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{newItem.sku ? 'Editar Consumible' : 'Registrar Consumible'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowItemModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label>SKU (Código único)</label>
                <input type="text" className="form-control" placeholder="Ej: AN002" value={newItem.sku} onChange={(e) => setNewItem({ ...newItem, sku: e.target.value })} disabled={!!newItem.stock && newItem.sku} required />
              </div>
              <div className="form-group mt-3">
                <label>Descripción / Nombre</label>
                <input type="text" className="form-control" placeholder="Ej: Disco de corte 4.5 pulgadas" value={newItem.descripcion} onChange={(e) => setNewItem({ ...newItem, descripcion: e.target.value })} required />
              </div>
              <div className="form-group mt-3">
                <label>Proveedor</label>
                <input type="text" className="form-control" placeholder="Ej: Soldasur" value={newItem.proveedor} onChange={(e) => setNewItem({ ...newItem, proveedor: e.target.value })} />
              </div>
              <div className="form-group mt-3">
                <label>Ubicación física</label>
                <input type="text" className="form-control" placeholder="Ej: Bodega Taller" value={newItem.ubicacion} onChange={(e) => setNewItem({ ...newItem, ubicacion: e.target.value })} />
              </div>
              <div className="form-group mt-3">
                <label>Stock Inicial</label>
                <input type="number" className="form-control" value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: parseFloat(e.target.value) || 0 })} min="0" required />
              </div>
              <div className="form-group mt-3">
                <label>Costo / Valor Unitario ($)</label>
                <input type="number" className="form-control" value={newItem.valor_unitario} onChange={(e) => setNewItem({ ...newItem, valor_unitario: parseFloat(e.target.value) || 0 })} min="0" required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                Guardar Consumible
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MOVIMIENTO DE INVENTARIO */}
      {showMovModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Registrar Entrada / Salida de Stock</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMovModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveMovimiento}>
              <div className="form-group">
                <label>Tipo de Movimiento</label>
                <select className="form-control" value={newMov.tipo} onChange={(e) => setNewMov({ ...newMov, tipo: e.target.value })}>
                  <option value="ENTRADA">ENTRADA (Compra / Abastecimiento)</option>
                  <option value="SALIDA">SALIDA (Consumo / Despacho)</option>
                </select>
              </div>
              <div className="form-group mt-3">
                <label>Seleccionar Artículo (SKU)</label>
                <select className="form-control" value={newMov.sku} onChange={(e) => {
                  const item = inventario.find(i => i.sku === e.target.value);
                  setNewMov({ 
                    ...newMov, 
                    sku: e.target.value,
                    valor_unitario: item ? item.valor_unitario : 0
                  });
                }} required>
                  <option value="">-- Seleccionar --</option>
                  {inventario.map(i => <option key={i.sku} value={i.sku}>{i.sku} - {i.descripcion} (Stock: {i.stock})</option>)}
                </select>
              </div>
              <div className="form-group mt-3">
                <label>Fecha</label>
                <input type="date" className="form-control" value={newMov.fecha} onChange={(e) => setNewMov({ ...newMov, fecha: e.target.value })} required />
              </div>
              <div className="form-group mt-3">
                <label>Cantidad</label>
                <input type="number" className="form-control" value={newMov.cantidad} onChange={(e) => setNewMov({ ...newMov, cantidad: parseFloat(e.target.value) || 0 })} min="0.1" step="any" required />
              </div>
              <div className="form-group mt-3">
                <label>Costo Unitario ($)</label>
                <input type="number" className="form-control" value={newMov.valor_unitario} onChange={(e) => setNewMov({ ...newMov, valor_unitario: parseFloat(e.target.value) || 0 })} min="0" required />
              </div>
              {newMov.tipo === 'ENTRADA' ? (
                <>
                  <div className="form-group mt-3">
                    <label>N° Factura (Opcional)</label>
                    <input type="text" className="form-control" placeholder="Ej: F-1294" value={newMov.factura_num} onChange={(e) => setNewMov({ ...newMov, factura_num: e.target.value })} />
                  </div>
                  <div className="form-group mt-3">
                    <label>Proveedor</label>
                    <input type="text" className="form-control" placeholder="Ej: Soldasur" value={newMov.proveedor_o_cliente} onChange={(e) => setNewMov({ ...newMov, proveedor_o_cliente: e.target.value })} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group mt-3">
                    <label>Asociar a Orden de Trabajo (OT)</label>
                    <select className="form-control" value={newMov.ot_id} onChange={(e) => setNewMov({ ...newMov, ot_id: e.target.value })}>
                      <option value="">-- Ninguna (Salida General) --</option>
                      {ots.map(ot => <option key={ot.id} value={ot.id}>OT {ot.id} - {ot.cliente_nombre}</option>)}
                    </select>
                  </div>
                  <div className="form-group mt-3">
                    <label>Entregado a / Cliente</label>
                    <input type="text" className="form-control" placeholder="Ej: Personal Maestranza" value={newMov.proveedor_o_cliente} onChange={(e) => setNewMov({ ...newMov, proveedor_o_cliente: e.target.value })} />
                  </div>
                </>
              )}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                Registrar Movimiento
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REGISTRAR/EDITAR ACTIVO */}
      {showActivoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>{newActivo.id ? 'Editar Activo' : 'Registrar Activo Fijo'}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowActivoModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveActivo}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Nombre del Equipo</label>
                  <input type="text" className="form-control" placeholder="Ej: Máquina de soldar" value={newActivo.nombre} onChange={(e) => setNewActivo({ ...newActivo, nombre: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Modelo</label>
                  <input type="text" className="form-control" placeholder="Ej: MAG200G" value={newActivo.modelo} onChange={(e) => setNewActivo({ ...newActivo, modelo: e.target.value })} />
                </div>
                <div className="form-group mt-2">
                  <label>Tipo / Especificación</label>
                  <input type="text" className="form-control" placeholder="Ej: 220 Volt" value={newActivo.tipo} onChange={(e) => setNewActivo({ ...newActivo, tipo: e.target.value })} />
                </div>
                <div className="form-group mt-2">
                  <label>Condición</label>
                  <select className="form-control" value={newActivo.condicion} onChange={(e) => setNewActivo({ ...newActivo, condicion: e.target.value })}>
                    <option value="Nuevo">Nuevo</option>
                    <option value="Bueno">Bueno / Operativo</option>
                    <option value="En Reparación">En Reparación</option>
                    <option value="Dañado">Dañado / Malo</option>
                  </select>
                </div>
                <div className="form-group mt-2">
                  <label>Ubicación</label>
                  <input type="text" className="form-control" placeholder="Ej: Bodega Taller" value={newActivo.ubicacion} onChange={(e) => setNewActivo({ ...newActivo, ubicacion: e.target.value })} />
                </div>
                <div className="form-group mt-2">
                  <label>Proveedor</label>
                  <input type="text" className="form-control" placeholder="Ej: SOLDASUR" value={newActivo.proveedor} onChange={(e) => setNewActivo({ ...newActivo, proveedor: e.target.value })} />
                </div>
                <div className="form-group mt-2">
                  <label>Valor de Compra ($)</label>
                  <input type="number" className="form-control" value={newActivo.valor_compra} onChange={(e) => setNewActivo({ ...newActivo, valor_compra: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="form-group mt-2">
                  <label>Garantía Vence (Fecha)</label>
                  <input type="date" className="form-control" value={newActivo.garantia_vencimiento} onChange={(e) => setNewActivo({ ...newActivo, garantia_vencimiento: e.target.value })} />
                </div>
                <div className="form-group mt-2" style={{ gridColumn: 'span 2' }}>
                  <label>Descripción detallada</label>
                  <input type="text" className="form-control" value={newActivo.descripcion} onChange={(e) => setNewActivo({ ...newActivo, descripcion: e.target.value })} />
                </div>
                <div className="form-group mt-2" style={{ gridColumn: 'span 2' }}>
                  <label>Observaciones</label>
                  <textarea className="form-control" rows="2" value={newActivo.observaciones} onChange={(e) => setNewActivo({ ...newActivo, observaciones: e.target.value })}></textarea>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                Guardar Activo Fijo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASIGNAR ACTIVO */}
      {showAsignarModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Asignar Activo: {selectedActivoToAssign?.nombre}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAsignarModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleAsignarActivo}>
              <div className="form-group">
                <label>Asignar a Trabajador (Persona)</label>
                <select className="form-control" value={asignarForm.trabajador_id} onChange={(e) => setAsignarForm({ ...asignarForm, trabajador_id: e.target.value })}>
                  <option value="">-- Ninguno (No asignar a persona) --</option>
                  {workers.map(w => <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>)}
                </select>
              </div>
              <div className="form-group mt-3">
                <label>Asociar a Orden de Trabajo (OT)</label>
                <select className="form-control" value={asignarForm.ot_id} onChange={(e) => setAsignarForm({ ...asignarForm, ot_id: e.target.value })}>
                  <option value="">-- Ninguna (No asociar a faena) --</option>
                  {ots.map(ot => <option key={ot.id} value={ot.id}>OT {ot.id} - {ot.cliente_nombre}</option>)}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                Guardar Asignación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREAR COTIZACION / PRESUPUESTADOR */}
      {showCotModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3>Crear Presupuesto Comercial</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCotModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveCotizacion}>
              <div className="form-group">
                <label>Seleccionar Cliente</label>
                <select className="form-control" value={newCot.cliente_id} onChange={(e) => setNewCot({ ...newCot, cliente_id: e.target.value })} required>
                  <option value="">-- Seleccionar --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                </select>
              </div>
              <div className="form-group mt-3">
                <label>Detalle / Título del Servicio Cotizado</label>
                <input type="text" className="form-control" placeholder="Ej: Reponer pasador en balde de doble volteo 7329.-" value={newCot.detalle} onChange={(e) => setNewCot({ ...newCot, detalle: e.target.value })} required />
              </div>

              {/* Mano de Obra Section */}
              <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--panel-border)' }}>
                <h4 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>1.- Mano de Obra (HH Estimadas)</h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.8rem' }}>Rol / Cargo</label>
                    <select className="form-control" value={cotHhInput.rol} onChange={(e) => {
                      const rolesTarifas = { Supervisor: 12000, Soldador: 10000, Mecanico: 9500, Ayudante: 7000 };
                      setCotHhInput({ ...cotHhInput, rol: e.target.value, valor_hh: rolesTarifas[e.target.value.replace('í', 'i')] || 10000 });
                    }}>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Soldador TIG">Soldador TIG</option>
                      <option value="Soldador">Soldador</option>
                      <option value="Mecánico">Mecánico</option>
                      <option value="Ayudante">Ayudante</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem' }}>Horas</label>
                    <input type="number" className="form-control" value={cotHhInput.horas} onChange={(e) => setCotHhInput({ ...cotHhInput, horas: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group" style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.8rem' }}>Valor HH ($)</label>
                    <input type="number" className="form-control" value={cotHhInput.valor_hh} onChange={(e) => setCotHhInput({ ...cotHhInput, valor_hh: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={handleAddHhCot}>Añadir</button>
                </div>

                <div className="table-container mt-2">
                  <table style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Rol</th>
                        <th>Horas</th>
                        <th>Valor HH</th>
                        <th>Subtotal</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(newCot.hh_estimadas || []).map((h, i) => (
                        <tr key={i}>
                          <td>{h.rol}</td>
                          <td>{h.horas} hrs</td>
                          <td className="notranslate">${h.valor_hh}</td>
                          <td className="notranslate" style={{ fontWeight: 600 }}>${h.horas * h.valor_hh}</td>
                          <td><button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveHhCot(i)}>🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Materiales Section */}
              <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--panel-border)' }}>
                <h4 style={{ fontSize: '1rem', margin: '0 0 1rem 0' }}>2.- Materiales e Insumos</h4>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.8rem' }}>Buscar SKU del Inventario</label>
                    <select className="form-control" value={cotMatInput.sku} onChange={(e) => {
                      const item = inventario.find(i => i.sku === e.target.value);
                      setCotMatInput({ ...cotMatInput, sku: e.target.value, valor_unitario: item ? item.valor_unitario : 0 });
                    }}>
                      <option value="">-- Seleccionar --</option>
                      {inventario.map(i => <option key={i.sku} value={i.sku}>{i.sku} - {i.descripcion}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem' }}>Cantidad</label>
                    <input type="number" className="form-control" value={cotMatInput.cantidad} onChange={(e) => setCotMatInput({ ...cotMatInput, cantidad: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group" style={{ flex: 1.5 }}>
                    <label style={{ fontSize: '0.8rem' }}>Costo Unitario ($)</label>
                    <input type="number" className="form-control" value={cotMatInput.valor_unitario} onChange={(e) => setCotMatInput({ ...cotMatInput, valor_unitario: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={handleAddMatCot}>Añadir</button>
                </div>

                <div className="table-container mt-2">
                  <table style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Detalle</th>
                        <th>Cant.</th>
                        <th>Costo Unit.</th>
                        <th>Subtotal</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(newCot.materiales_estimados || []).map((m, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{m.sku}</td>
                          <td>{m.descripcion}</td>
                          <td>{m.cantidad}</td>
                          <td className="notranslate">${m.valor_unitario}</td>
                          <td className="notranslate" style={{ fontWeight: 600 }}>${m.cantidad * m.valor_unitario}</td>
                          <td><button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveMatCot(i)}>🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terceros y Utilidad */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.5rem' }}>
                <div className="form-group">
                  <label>3.- Servicios de Terceros / Otros Costos ($)</label>
                  <input type="number" className="form-control" value={newCot.terceros_estimados} onChange={(e) => setNewCot({ ...newCot, terceros_estimados: parseFloat(e.target.value) || 0 })} min="0" />
                </div>
                <div className="form-group">
                  <label>Porcentaje de Utilidad Esperado (%)</label>
                  <input type="number" className="form-control" value={newCot.utilidad_porcentaje} onChange={(e) => setNewCot({ ...newCot, utilidad_porcentaje: parseFloat(e.target.value) || 25 })} min="0" />
                </div>
              </div>

              {/* TOTALS BOARD */}
              {(() => {
                const totals = calculateCotTotals();
                return (
                  <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(52, 211, 153, 0.05)', border: '1px solid rgba(52, 211, 153, 0.2)', borderRadius: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', textAlign: 'center' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Costo Mano Obra</div>
                      <strong className="notranslate" style={{ fontSize: '1.1rem' }}>${Math.round(totals.subtotalHh).toLocaleString('es-CL')}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Costo Materiales</div>
                      <strong className="notranslate" style={{ fontSize: '1.1rem' }}>${Math.round(totals.subtotalMat).toLocaleString('es-CL')}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Costo Subtotal</div>
                      <strong className="notranslate" style={{ fontSize: '1.1rem' }}>${Math.round(totals.costoSubtotal).toLocaleString('es-CL')}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Neto Comercial (+Utilidad)</div>
                      <strong className="notranslate" style={{ fontSize: '1.2rem', color: 'var(--success)' }}>${Math.round(totals.neto).toLocaleString('es-CL')}</strong>
                    </div>
                  </div>
                );
              })()}

              <button type="submit" className="btn btn-primary mt-3" style={{ width: '100%' }}>
                Guardar Cotización en el Sistema
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: APROBAR COTIZACIÓN - Custom (reemplaza window.prompt) */}
      {showAprobarModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>Aprobar Cotización</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAprobarModal(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              La cotización será marcada como <strong style={{ color: 'var(--success)' }}>APROBADA</strong> y se creará automáticamente una Orden de Trabajo con los datos presupuestados.
            </p>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label>Número de OT a Crear (Ej: OT-541)</label>
              <input
                type="text"
                className="form-control"
                value={aprobarOtIdInput}
                onChange={(e) => setAprobarOtIdInput(e.target.value)}
                placeholder="Ej: OT-541"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmAprobar(); }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowAprobarModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleConfirmAprobar}>✅ Confirmar y Crear OT</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMACIÓN GENÉRICA (reemplaza window.confirm) */}
      {confirmModal.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--accent-danger)', fontSize: '1.2rem' }}>⚠️</span> Confirmar Acción
              </h3>
            </div>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 1.5rem 0', lineHeight: '1.5', fontSize: '0.9rem' }}>
              {confirmModal.message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setConfirmModal({ show: false, message: '', onConfirm: null })}>
                Cancelar
              </button>
              <button
                className="btn"
                style={{ background: 'var(--accent-danger)', color: '#fff', border: 'none', cursor: 'pointer', padding: '0.5rem 1.25rem', borderRadius: '0.5rem', fontWeight: 600 }}
                onClick={() => confirmModal.onConfirm && confirmModal.onConfirm()}
              >
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISTA PREVIA E IMPRESIÓN DE COTIZACIÓN */}
      {showPrintCotModal && selectedCotToPrint && (() => {
        const cot = selectedCotToPrint;
        const net = cot.monto_neto_presupuesto || 0;
        const iva = net * 0.19;
        const total = net + iva;
        const hh = (() => { try { return JSON.parse(cot.hh_estimadas || '[]'); } catch { return []; } })();
        const mat = (() => { try { return JSON.parse(cot.materiales_estimados || '[]'); } catch { return []; } })();
        const subtotalHh = hh.reduce((s, h) => s + (h.horas * h.valor_hh), 0);
        const subtotalMat = mat.reduce((s, m) => s + (m.cantidad * m.valor_unitario), 0);
        const hoy = new Date().toLocaleDateString('es-CL', { year: 'numeric', month: 'long', day: 'numeric' });
        return (
          <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.88)' }}>
            <div className="modal-content" style={{ maxWidth: '780px', background: '#fff', color: '#222', padding: '2.5rem', borderRadius: '0.5rem', fontFamily: 'Arial, sans-serif', maxHeight: '92vh', overflowY: 'auto' }}>
              {/* Encabezado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '3px solid #1a4fa8', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, color: '#1a4fa8', fontWeight: 'bold', fontSize: '1.5rem' }}>TRIMEC SpA</h2>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#555' }}>Servicios Metalmecánicos y Maestranza Industrial</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#777' }}>Yungay, Región del Biobío &nbsp;|&nbsp; +56 9 XXXX XXXX</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: 0, color: '#222', fontSize: '1.1rem' }}>COTIZACIÓN DE SERVICIO</h3>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '1rem', fontWeight: 'bold', color: '#1a4fa8' }}>COT-{cot.id}</p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#555' }}>Fecha: {hoy}</p>
                </div>
              </div>

              {/* Info Cliente */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.88rem' }}>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.4rem 0.6rem', background: '#f0f4ff', border: '1px solid #dde', fontWeight: 'bold', width: '130px' }}>Cliente</td>
                    <td style={{ padding: '0.4rem 0.6rem', border: '1px solid #dde', fontWeight: '600' }}>{cot.cliente_nombre}</td>
                    <td style={{ padding: '0.4rem 0.6rem', background: '#f0f4ff', border: '1px solid #dde', fontWeight: 'bold', width: '120px' }}>N° Cotización</td>
                    <td style={{ padding: '0.4rem 0.6rem', border: '1px solid #dde', fontWeight: '600', color: '#1a4fa8' }}>COT-{cot.id}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.4rem 0.6rem', background: '#f0f4ff', border: '1px solid #dde', fontWeight: 'bold' }}>Descripción</td>
                    <td colSpan="3" style={{ padding: '0.4rem 0.6rem', border: '1px solid #dde' }}>{cot.detalle}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.4rem 0.6rem', background: '#f0f4ff', border: '1px solid #dde', fontWeight: 'bold' }}>Fecha</td>
                    <td style={{ padding: '0.4rem 0.6rem', border: '1px solid #dde' }}>{cot.fecha_creacion}</td>
                    <td style={{ padding: '0.4rem 0.6rem', background: '#f0f4ff', border: '1px solid #dde', fontWeight: 'bold' }}>Estado</td>
                    <td style={{ padding: '0.4rem 0.6rem', border: '1px solid #dde' }}>
                      <span style={{ background: cot.estado === 'APROBADA' ? '#d4edda' : '#fff3cd', color: cot.estado === 'APROBADA' ? '#155724' : '#856404', padding: '0.15rem 0.5rem', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.8rem' }}>
                        {cot.estado}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Detalle HH */}
              {hh.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#1a4fa8', fontSize: '0.9rem', borderBottom: '1px solid #dde', paddingBottom: '0.3rem' }}>MANO DE OBRA (HORAS HOMBRE)</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f0f4ff' }}>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'left' }}>Rol</th>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>Horas</th>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>Valor/HH</th>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hh.map((h, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde' }}>{h.rol}</td>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>{h.horas}</td>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>${Math.round(h.valor_hh).toLocaleString('es-CL')}</td>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde', textAlign: 'right', fontWeight: '600' }}>${Math.round(h.horas * h.valor_hh).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f0f4ff' }}>
                        <td colSpan="3" style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right', fontWeight: 'bold' }}>Subtotal HH</td>
                        <td style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right', fontWeight: 'bold' }}>${Math.round(subtotalHh).toLocaleString('es-CL')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Detalle Materiales */}
              {mat.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#1a4fa8', fontSize: '0.9rem', borderBottom: '1px solid #dde', paddingBottom: '0.3rem' }}>MATERIALES E INSUMOS</h4>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: '#f0f4ff' }}>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'left' }}>SKU</th>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'left' }}>Descripción</th>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>Cant.</th>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>Valor Unit.</th>
                        <th style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mat.map((m, i) => (
                        <tr key={i}>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde', fontFamily: 'monospace', fontSize: '0.8rem' }}>{m.sku}</td>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde' }}>{m.descripcion}</td>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>{m.cantidad}</td>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde', textAlign: 'right' }}>${Math.round(m.valor_unitario).toLocaleString('es-CL')}</td>
                          <td style={{ padding: '0.3rem 0.5rem', border: '1px solid #dde', textAlign: 'right', fontWeight: '600' }}>${Math.round(m.cantidad * m.valor_unitario).toLocaleString('es-CL')}</td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f0f4ff' }}>
                        <td colSpan="4" style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right', fontWeight: 'bold' }}>Subtotal Materiales</td>
                        <td style={{ padding: '0.35rem 0.5rem', border: '1px solid #dde', textAlign: 'right', fontWeight: 'bold' }}>${Math.round(subtotalMat).toLocaleString('es-CL')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Resumen Financiero */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <table style={{ borderCollapse: 'collapse', fontSize: '0.9rem', minWidth: '280px' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '0.35rem 0.75rem', border: '1px solid #dde', color: '#555' }}>Neto sin Utilidad</td>
                      <td style={{ padding: '0.35rem 0.75rem', border: '1px solid #dde', textAlign: 'right' }}>${Math.round(subtotalHh + subtotalMat).toLocaleString('es-CL')}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.35rem 0.75rem', border: '1px solid #dde', color: '#555' }}>Utilidad ({cot.utilidad_porcentaje || 25}%)</td>
                      <td style={{ padding: '0.35rem 0.75rem', border: '1px solid #dde', textAlign: 'right' }}>${Math.round(net - (subtotalHh + subtotalMat)).toLocaleString('es-CL')}</td>
                    </tr>
                    <tr style={{ background: '#f0f4ff' }}>
                      <td style={{ padding: '0.35rem 0.75rem', border: '1px solid #dde', fontWeight: 'bold' }}>Neto (sin IVA)</td>
                      <td style={{ padding: '0.35rem 0.75rem', border: '1px solid #dde', textAlign: 'right', fontWeight: 'bold' }}>${Math.round(net).toLocaleString('es-CL')}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '0.35rem 0.75rem', border: '1px solid #dde', color: '#555' }}>IVA (19%)</td>
                      <td style={{ padding: '0.35rem 0.75rem', border: '1px solid #dde', textAlign: 'right' }}>${Math.round(iva).toLocaleString('es-CL')}</td>
                    </tr>
                    <tr style={{ background: '#1a4fa8' }}>
                      <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #1a4fa8', fontWeight: 'bold', color: '#fff', fontSize: '1rem' }}>TOTAL (c/IVA)</td>
                      <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #1a4fa8', textAlign: 'right', fontWeight: 'bold', color: '#fff', fontSize: '1rem' }}>${Math.round(total).toLocaleString('es-CL')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Notas y Firma */}
              <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div style={{ border: '1px dashed #ccc', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', color: '#666' }}>
                  <strong>Notas:</strong>
                  <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1.25rem' }}>
                    <li>Cotización válida por 30 días desde su emisión.</li>
                    <li>Precios en pesos chilenos (CLP), neto sin IVA.</li>
                    <li>Plazo de ejecución a confirmar al aprobar.</li>
                  </ul>
                </div>
                <div style={{ textAlign: 'center', paddingTop: '1rem' }}>
                  <div style={{ borderTop: '1px solid #333', marginTop: '2rem', paddingTop: '0.5rem', fontSize: '0.8rem', color: '#555' }}>
                    <strong>Angelo Muñoz V.</strong><br />Ing. Mecánico – TRIMEC SpA
                  </div>
                </div>
              </div>

              {/* Botones */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1.25rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowPrintCotModal(false)} style={{ background: '#555', color: '#fff', border: 'none', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                  Cerrar
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => window.print()} style={{ background: '#1a4fa8', color: '#fff', border: 'none', padding: '0.4rem 1.25rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                  🖨️ Imprimir
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default DashboardAdmin;

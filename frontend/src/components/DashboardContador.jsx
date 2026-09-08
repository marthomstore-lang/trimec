import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const DashboardContador = ({ onSelectOt, showToast }) => {
  const [billingList, setBillingList] = useState([]);
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [cashFlow, setCashFlow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('facturacion'); // 'facturacion', 'gastos-generales', 'flujo-caja'
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [showEditBillingModal, setShowEditBillingModal] = useState(false);
  const [selectedBilling, setSelectedBilling] = useState(null);

  // New Billing modal states
  const [showAddBillingModal, setShowAddBillingModal] = useState(false);
  const [availableOts, setAvailableOts] = useState([]);
  const [newBilling, setNewBilling] = useState({
    ot_id: '',
    nro_oc: '',
    fecha_oc: '',
    nro_hes: '',
    nro_factura: '',
    fecha_factura: '',
    estado_pago: 'Pendiente',
    fecha_vencimiento: '',
    fecha_pago: ''
  });

  // Quick mark paid modal
  const [showMarkPaidModal, setShowMarkPaidModal] = useState(false);
  const [billToMarkPaid, setBillToMarkPaid] = useState(null);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  // Edit general expense modal
  const [showEditGgModal, setShowEditGgModal] = useState(false);
  const [editingGeneralExpense, setEditingGeneralExpense] = useState(null);

  const [newGeneralExpense, setNewGeneralExpense] = useState({
    fecha: new Date().toISOString().split('T')[0],
    familia: 'Arriendo',
    detalle: '',
    valor_total: '',
    estado_pago: 'Pagado',
    fecha_vencimiento: ''
  });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [billingData, ggData, flujoData] = await Promise.all([
        api('/facturacion'),
        api('/finanzas/gastos-generales'),
        api('/finanzas/flujo-caja')
      ]);
      setBillingList(billingData);
      setGeneralExpenses(ggData);
      setCashFlow(flujoData);
    } catch (err) {
      setError(err.message || 'Error al cargar los datos financieros');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableOts = async () => {
    try {
      const ots = await api('/facturacion/ots-disponibles');
      setAvailableOts(ots);
    } catch (err) {
      console.error('Error al obtener OTs disponibles:', err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchAvailableOts();
  }, []);

  useEffect(() => {
    if (activeTab === 'facturacion') {
      document.title = 'Trimec - Cobros y Facturación';
    } else if (activeTab === 'gastos-generales') {
      document.title = 'Trimec - Gastos Operacionales';
    } else {
      document.title = 'Trimec - Flujo de Caja';
    }
  }, [activeTab]);

  const handleOpenAddBilling = () => {
    fetchAvailableOts();
    setNewBilling({
      ot_id: '',
      nro_oc: '',
      fecha_oc: '',
      nro_hes: '',
      nro_factura: '',
      fecha_factura: '',
      estado_pago: 'Pendiente',
      fecha_vencimiento: '',
      fecha_pago: ''
    });
    setShowAddBillingModal(true);
  };

  const handleSaveNewBilling = async (e) => {
    e.preventDefault();
    if (!newBilling.ot_id) {
      showToast('Selecciona una Orden de Trabajo', 'danger');
      return;
    }
    try {
      await api('/facturacion', {
        method: 'POST',
        body: JSON.stringify(newBilling)
      });
      showToast(`Facturación de OT ${newBilling.ot_id} registrada con éxito`, 'success');
      setShowAddBillingModal(false);
      fetchData();
      fetchAvailableOts();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleEditBilling = (bill) => {
    setSelectedBilling({
      ot_id: bill.ot_id,
      nro_oc: bill.nro_oc || '',
      fecha_oc: bill.fecha_oc || '',
      nro_hes: bill.nro_hes || '',
      nro_factura: bill.nro_factura || '',
      fecha_factura: bill.fecha_factura || '',
      estado_pago: bill.estado_pago || 'Pendiente',
      fecha_vencimiento: bill.fecha_vencimiento || '',
      fecha_pago: bill.fecha_pago || ''
    });
    setShowEditBillingModal(true);
  };

  const handleSaveBilling = async (e) => {
    e.preventDefault();
    try {
      await api(`/facturacion/${selectedBilling.ot_id}`, {
        method: 'PUT',
        body: JSON.stringify(selectedBilling)
      });
      showToast('Datos de facturación guardados', 'success');
      setShowEditBillingModal(false);
      setSelectedBilling(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  // Quick action: Marcar Pagado
  const handleOpenMarkPaid = (bill) => {
    setBillToMarkPaid(bill);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setShowMarkPaidModal(true);
  };

  const handleConfirmMarkPaid = async (e) => {
    e.preventDefault();
    if (!billToMarkPaid) return;
    try {
      await api(`/facturacion/${billToMarkPaid.ot_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nro_oc: billToMarkPaid.nro_oc,
          fecha_oc: billToMarkPaid.fecha_oc,
          nro_hes: billToMarkPaid.nro_hes,
          nro_factura: billToMarkPaid.nro_factura,
          fecha_factura: billToMarkPaid.fecha_factura,
          fecha_vencimiento: billToMarkPaid.fecha_vencimiento,
          estado_pago: 'Pagado',
          fecha_pago: paymentDate
        })
      });
      showToast(`OT ${billToMarkPaid.ot_id} marcada como Pagada (${paymentDate})`, 'success');
      setShowMarkPaidModal(false);
      setBillToMarkPaid(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleCreateGeneralExpense = async (e) => {
    e.preventDefault();
    try {
      await api('/finanzas/gastos-generales', {
        method: 'POST',
        body: JSON.stringify({
          ...newGeneralExpense,
          valor_total: parseFloat(newGeneralExpense.valor_total),
          estado_pago: newGeneralExpense.estado_pago,
          fecha_vencimiento: newGeneralExpense.fecha_vencimiento || null
        })
      });
      showToast('Gasto fijo registrado con éxito', 'success');
      setNewGeneralExpense({
        fecha: new Date().toISOString().split('T')[0],
        familia: 'Arriendo',
        detalle: '',
        valor_total: '',
        estado_pago: 'Pagado',
        fecha_vencimiento: ''
      });
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleEditGeneralExpense = (rec) => {
    setEditingGeneralExpense({
      id: rec.id,
      fecha: rec.fecha || '',
      familia: rec.familia || 'Arriendo',
      detalle: rec.detalle || '',
      valor_total: rec.valor_total || '',
      estado_pago: rec.estado_pago || 'Pagado',
      fecha_vencimiento: rec.fecha_vencimiento || ''
    });
    setShowEditGgModal(true);
  };

  const handleUpdateGeneralExpense = async (e) => {
    e.preventDefault();
    if (!editingGeneralExpense) return;
    try {
      await api(`/finanzas/gastos-generales/${editingGeneralExpense.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...editingGeneralExpense,
          valor_total: parseFloat(editingGeneralExpense.valor_total),
          fecha_vencimiento: editingGeneralExpense.fecha_vencimiento || null
        })
      });
      showToast('Gasto general actualizado con éxito', 'success');
      setShowEditGgModal(false);
      setEditingGeneralExpense(null);
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDeleteGeneralExpense = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este gasto fijo?')) return;
    try {
      await api(`/finanzas/gastos-generales/${id}`, { method: 'DELETE' });
      showToast('Gasto fijo eliminado', 'success');
      fetchData();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  };

  const handleDownloadFlujoPdf = () => {
    const token = localStorage.getItem('trimec_token');
    const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    window.open(`${BASE_URL}/finanzas/flujo-caja/pdf?token=${token || ''}`, '_blank');
  };

  const filteredBills = billingList.filter(bill => 
    bill.ot_id.toString().includes(searchQuery) ||
    bill.cliente_nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (bill.nro_oc && bill.nro_oc.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (bill.nro_factura && bill.nro_factura.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Calcular proyecciones de dineros futuros y pagos por ejecutar por mes
  const getProyecciones = () => {
    const proyecciones = {};

    // 1. Cobros futuros (dineros futuros)
    billingList.forEach(bill => {
      if (bill.estado_pago === 'Pendiente' && bill.monto_neto_presupuesto) {
        const fecha = bill.fecha_vencimiento || bill.fecha_factura || new Date().toISOString().split('T')[0];
        const mes = fecha.substring(0, 7); // YYYY-MM
        if (!proyecciones[mes]) {
          proyecciones[mes] = { mes, ingresosFuturos: 0, egresosFuturos: 0 };
        }
        proyecciones[mes].ingresosFuturos += parseFloat(bill.monto_neto_presupuesto);
      }
    });

    // 2. Pagos futuros (pagos por ejecutar)
    generalExpenses.forEach(exp => {
      if (exp.estado_pago === 'Pendiente' && exp.valor_total) {
        const fecha = exp.fecha_vencimiento || exp.fecha;
        const mes = fecha.substring(0, 7); // YYYY-MM
        if (!proyecciones[mes]) {
          proyecciones[mes] = { mes, ingresosFuturos: 0, egresosFuturos: 0 };
        }
        proyecciones[mes].egresosFuturos += parseFloat(exp.valor_total);
      }
    });

    return Object.values(proyecciones).sort((a, b) => a.mes.localeCompare(b.mes));
  };

  const proyeccionesList = getProyecciones();

  return (
    <div className="dashboard-container">
      <div className="dashboard-title-bar">
        <div>
          <h2>Panel de Contabilidad (Finanzas)</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Control de facturación, emisión de OCs, HES y flujo de caja consolidado</p>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${activeTab === 'facturacion' ? 'active' : ''}`} onClick={() => setActiveTab('facturacion')}>
          💼 Facturación de OTs ({billingList.length})
        </button>
        <button className={`tab-btn ${activeTab === 'gastos-generales' ? 'active' : ''}`} onClick={() => setActiveTab('gastos-generales')}>
          🏠 Gastos Generales (Egresos Fijos)
        </button>
        <button className={`tab-btn ${activeTab === 'flujo-caja' ? 'active' : ''}`} onClick={() => setActiveTab('flujo-caja')}>
          📊 Flujo de Caja Mensual
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ textAlign: 'center', padding: '2rem' }}>Cargando información financiera...</p>
      ) : (
        <div>
          {/* TAB 1: OTS BILLING PIPELINE */}
          {activeTab === 'facturacion' && (
            <div className="panel-card">
              <div className="panel-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3>Pipeline de Cobro de OTs</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Gestión de OCs, HES, Facturas SII y Registro de Pagos</p>
                </div>
                <button className="btn btn-primary" onClick={handleOpenAddBilling}>
                  ➕ Agregar Facturación
                </button>
              </div>

              <div className="search-container">
                <span className="search-icon-placeholder">🔍</span>
                <input 
                  type="text" 
                  className="search-control" 
                  placeholder="Buscar facturación por OT, cliente, OC o Factura..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>OT</th>
                      <th>Cliente</th>
                      <th>Detalle Trabajo</th>
                      <th>Monto Neto</th>
                      <th>Orden Compra (OC)</th>
                      <th>HES</th>
                      <th>Factura N°</th>
                      <th>Estado Pago</th>
                      <th>Fecha Pago</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((bill) => (
                      <tr key={bill.id}>
                        <td 
                          style={{ fontWeight: 700, color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={() => onSelectOt(bill.ot_id)}
                          title="Ver detalles de la OT"
                        >
                          OT {bill.ot_id}
                        </td>
                        <td style={{ fontWeight: 600 }}>{bill.cliente_nombre}</td>
                        <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{bill.ot_detalle}</td>
                        <td className="text-right">${Math.round(bill.monto_neto_presupuesto).toLocaleString('es-CL')}</td>
                        <td>{bill.nro_oc ? <span>{bill.nro_oc} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({bill.fecha_oc})</span></span> : <span style={{ color: 'var(--text-danger)', fontWeight: 500 }}>Pendiente</span>}</td>
                        <td>{bill.nro_hes ? <span>{bill.nro_hes}</span> : <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                        <td>{bill.nro_factura ? <span>{bill.nro_factura} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({bill.fecha_factura})</span></span> : <span style={{ color: 'var(--text-muted)' }}>No facturado</span>}</td>
                        <td>
                          <span className={`badge ${bill.estado_pago === 'Pagado' ? 'badge-aprobada' : bill.estado_pago === 'Anulado' ? 'badge-sp' : 'badge-presupuestada'}`}>
                            {bill.estado_pago}
                          </span>
                        </td>
                        <td>
                          {bill.fecha_pago ? (
                            <strong style={{ color: '#34d399', fontSize: '0.85rem' }}>{bill.fecha_pago}</strong>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleEditBilling(bill)}>
                              ✏️ Facturar
                            </button>
                            {bill.estado_pago !== 'Pagado' && (
                              <button 
                                className="btn btn-secondary btn-sm" 
                                style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.25rem 0.5rem' }} 
                                onClick={() => handleOpenMarkPaid(bill)}
                                title="Marcar como Pagado y registrar fecha para Flujo de Caja"
                              >
                                💰 Pagado
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }} onClick={() => onSelectOt(bill.ot_id)} title="Ver OT">
                              🔍
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredBills.length === 0 && (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                          No se encontraron registros de facturación.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: GASTOS GENERALES */}
          {activeTab === 'gastos-generales' && (
            <div className="dashboard-layout">
              {/* Form */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Cargar Egresos Generales (Mensuales/Fijos)</h3>
                </div>
                <form onSubmit={handleCreateGeneralExpense}>
                  <div className="form-group">
                    <label>Categoría / Familia Gasto</label>
                    <select className="form-control" value={newGeneralExpense.familia} onChange={(e) => setNewGeneralExpense({ ...newGeneralExpense, familia: e.target.value })}>
                      <option value="Arriendo">Arriendo Oficina/Taller</option>
                      <option value="Sueldos Base">Sueldos Fijos (Administrativos)</option>
                      <option value="Luz">Electricidad</option>
                      <option value="Agua">Agua Potable</option>
                      <option value="Internet">Internet y Comunicaciones</option>
                      <option value="Imposiciones">Imposiciones y Cotizaciones</option>
                      <option value="Contador">Honorarios Contador</option>
                      <option value="Combustible">Combustible General</option>
                      <option value="Gases">Gases Industriales (Biox/otros)</option>
                      <option value="Prestamo">Pago de Préstamo / Crédito</option>
                      <option value="Factoring">Factoring</option>
                      <option value="Iva">Pago de IVA (SII)</option>
                      <option value="Otros">Otros Egresos</option>
                    </select>
                  </div>

                  <div className="flex-row-gap">
                    <div className="form-group flex-grow">
                      <label>Fecha del Pago</label>
                      <input type="date" className="form-control" value={newGeneralExpense.fecha} onChange={(e) => setNewGeneralExpense({ ...newGeneralExpense, fecha: e.target.value })} required />
                    </div>
                    <div className="form-group flex-grow">
                      <label>Monto Total Pagado ($)</label>
                      <input type="number" className="form-control" placeholder="Ej: 160000" value={newGeneralExpense.valor_total} onChange={(e) => setNewGeneralExpense({ ...newGeneralExpense, valor_total: e.target.value })} required />
                    </div>
                  </div>

                  <div className="flex-row-gap">
                    <div className="form-group flex-grow">
                      <label>Estado de Pago</label>
                      <select className="form-control" value={newGeneralExpense.estado_pago} onChange={(e) => setNewGeneralExpense({ ...newGeneralExpense, estado_pago: e.target.value })}>
                        <option value="Pagado">Pagado</option>
                        <option value="Pendiente">Pendiente</option>
                      </select>
                    </div>
                    <div className="form-group flex-grow">
                      <label>Fecha Vencimiento (Si está Pendiente)</label>
                      <input type="date" className="form-control" value={newGeneralExpense.fecha_vencimiento} onChange={(e) => setNewGeneralExpense({ ...newGeneralExpense, fecha_vencimiento: e.target.value })} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Detalle / Glosa del Egreso</label>
                    <textarea className="form-control" rows="2" placeholder="Ej: Pago de arriendo del taller correspondiente a Julio 2026" value={newGeneralExpense.detalle} onChange={(e) => setNewGeneralExpense({ ...newGeneralExpense, detalle: e.target.value })} required></textarea>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Registrar Egreso</button>
                </form>
              </div>

              {/* List */}
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Egresos Fijos Recientes</h3>
                </div>
                <div className="table-container" style={{ maxHeight: '480px', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Familia</th>
                        <th>Detalle</th>
                        <th>Total ($)</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generalExpenses.map((rec) => (
                        <tr key={rec.id}>
                          <td>{rec.fecha}</td>
                          <td style={{ fontWeight: 600, color: 'var(--accent-purple)' }}>{rec.familia}</td>
                          <td style={{ fontSize: '0.85rem' }}>{rec.detalle}</td>
                          <td className="text-right" style={{ fontWeight: 700 }}>${Math.round(rec.valor_total).toLocaleString('es-CL')}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleEditGeneralExpense(rec)} title="Editar Egreso">
                                ✏️
                              </button>
                              <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDeleteGeneralExpense(rec.id)} title="Eliminar Egreso">
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {generalExpenses.length === 0 && (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>No hay egresos generales registrados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FLUJO DE CAJA MENSUAL */}
          {activeTab === 'flujo-caja' && (
            <div className="panel-card">
              <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3>Balance Financiero de Caja por Mes</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Cruce de ingresos reales cobrados (computados en su fecha de pago) contra egresos fijos y gastos de OTs.
                  </p>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleDownloadFlujoPdf} style={{ background: '#0284c7', borderColor: '#0284c7' }}>
                  📥 Descargar PDF Flujo de Caja
                </button>
              </div>

              {/* GRÁFICO DE PROYECCIONES */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', margin: '1.5rem 0', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid var(--panel-border)' }}>
                <h4 style={{ margin: 0, color: 'var(--primary)' }}>Proyecciones de Caja: Dineros Futuros vs Pagos por Ejecutar</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Muestra el total de dinero pendiente por cobrar de OTs facturadas y egresos fijos registrados como pendientes agrupados por fecha de vencimiento.</p>
                {proyeccionesList.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.9rem', margin: '1rem 0 0 0' }}>No hay cobros ni egresos pendientes proyectados (marca cobros/pagos como "Pendiente" y asigna una fecha de vencimiento para visualizarlos).</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
                    {proyeccionesList.map(proj => {
                      const maxVal = Math.max(...proyeccionesList.map(p => Math.max(p.ingresosFuturos, p.egresosFuturos)));
                      const ingPct = maxVal > 0 ? (proj.ingresosFuturos / maxVal) * 100 : 0;
                      const egrPct = maxVal > 0 ? (proj.egresosFuturos / maxVal) * 100 : 0;
                      return (
                        <div key={proj.mes} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: '1.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-primary)' }}>{proj.mes}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {/* Ingresos Futuros Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: `${ingPct}%`, minWidth: proj.ingresosFuturos > 0 ? '6px' : '0px', height: '14px', background: 'linear-gradient(90deg, #10b981, #34d399)', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                              {proj.ingresosFuturos > 0 ? (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399' }}>Cobro pendiente: +${Math.round(proj.ingresosFuturos).toLocaleString('es-CL')}</span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin cobros proyectados</span>
                              )}
                            </div>
                            {/* Egresos Futuros Bar */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ width: `${egrPct}%`, minWidth: proj.egresosFuturos > 0 ? '6px' : '0px', height: '14px', background: 'linear-gradient(90deg, #ef4444, #f87171)', borderRadius: '4px', transition: 'width 0.3s' }}></div>
                              {proj.egresosFuturos > 0 ? (
                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f87171' }}>Pago por ejecutar: -${Math.round(proj.egresosFuturos).toLocaleString('es-CL')}</span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin pagos proyectados</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Ingresos Facturados y Cobrados (Neto)</th>
                      <th>Egresos Generales y OT</th>
                      <th>Saldo Neto de Caja</th>
                      <th>Desempeño Visual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlow.map((flow) => {
                      const profit = flow.ingresos - flow.egresos;
                      return (
                        <tr key={flow.mes}>
                          <td style={{ fontWeight: 700, fontSize: '1.05rem', textTransform: 'uppercase' }}>{flow.mes}</td>
                          <td className="text-right" style={{ color: '#34d399', fontWeight: 600 }}>${Math.round(flow.ingresos).toLocaleString('es-CL')}</td>
                          <td className="text-right" style={{ color: '#f87171' }}>${Math.round(flow.egresos).toLocaleString('es-CL')}</td>
                          <td className="text-right" style={{ fontWeight: 800, color: profit >= 0 ? '#34d399' : '#f87171', fontSize: '1.05rem' }}>
                            ${Math.round(profit).toLocaleString('es-CL')}
                          </td>
                          <td>
                            <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '14px', borderRadius: '999px', overflow: 'hidden', display: 'flex' }}>
                              {flow.ingresos > 0 || flow.egresos > 0 ? (
                                <>
                                  <div style={{ width: `${(flow.ingresos / (flow.ingresos + flow.egresos)) * 100}%`, background: '#10b981' }}></div>
                                  <div style={{ width: `${(flow.egresos / (flow.ingresos + flow.egresos)) * 100}%`, background: '#ef4444' }}></div>
                                </>
                              ) : (
                                <div style={{ width: '100%', background: 'var(--text-muted)' }}></div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {cashFlow.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                          No hay suficiente historial para calcular el balance de flujo de caja.
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

      {/* MODAL: AGREGAR NUEVA FACTURACIÓN */}
      {showAddBillingModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>➕ Agregar Facturación de OT</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddBillingModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveNewBilling}>
              <div className="form-group">
                <label>Seleccionar Orden de Trabajo *</label>
                <select 
                  className="form-control" 
                  value={newBilling.ot_id} 
                  onChange={(e) => {
                    const selOt = availableOts.find(o => o.id.toString() === e.target.value);
                    setNewBilling({
                      ...newBilling,
                      ot_id: e.target.value
                    });
                  }}
                  required
                >
                  <option value="">-- Seleccionar OT --</option>
                  {availableOts.map(o => (
                    <option key={o.id} value={o.id}>
                      OT {o.id} - {o.cliente_nombre} ({o.detalle ? o.detalle.substring(0, 35) : ''}...) [Etapa: {o.estado}]
                    </option>
                  ))}
                </select>
              </div>

              {newBilling.ot_id && (
                (() => {
                  const sel = availableOts.find(o => o.id.toString() === newBilling.ot_id.toString());
                  return sel ? (
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                      <div><strong>Cliente:</strong> {sel.cliente_nombre}</div>
                      <div><strong>Detalle:</strong> {sel.detalle}</div>
                      <div><strong>Monto Neto Presupuesto:</strong> ${Math.round(sel.monto_neto_presupuesto || 0).toLocaleString('es-CL')}</div>
                      <div><strong>Estado OT:</strong> <span className="badge badge-proceso">{sel.estado}</span></div>
                    </div>
                  ) : null;
                })()
              )}

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Número de OC (Orden Compra)</label>
                  <input type="text" className="form-control" placeholder="Ej: OC-4560" value={newBilling.nro_oc} onChange={(e) => setNewBilling({ ...newBilling, nro_oc: e.target.value })} />
                </div>
                <div className="form-group flex-grow">
                  <label>Fecha Recepción OC</label>
                  <input type="date" className="form-control" value={newBilling.fecha_oc} onChange={(e) => setNewBilling({ ...newBilling, fecha_oc: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Número HES (Hoja Entrada Servicio)</label>
                <input type="text" className="form-control" placeholder="Ej: HES-77123" value={newBilling.nro_hes} onChange={(e) => setNewBilling({ ...newBilling, nro_hes: e.target.value })} />
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Número Factura SII</label>
                  <input type="text" className="form-control" placeholder="Ej: Factura 103" value={newBilling.nro_factura} onChange={(e) => setNewBilling({ ...newBilling, nro_factura: e.target.value })} />
                </div>
                <div className="form-group flex-grow">
                  <label>Fecha Emisión Factura</label>
                  <input type="date" className="form-control" value={newBilling.fecha_factura} onChange={(e) => setNewBilling({ ...newBilling, fecha_factura: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Fecha de Vencimiento de Factura</label>
                <input type="date" className="form-control" value={newBilling.fecha_vencimiento} onChange={(e) => setNewBilling({ ...newBilling, fecha_vencimiento: e.target.value })} />
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Estado de Cobro / Pago</label>
                  <select className="form-control" value={newBilling.estado_pago} onChange={(e) => setNewBilling({ ...newBilling, estado_pago: e.target.value })}>
                    <option value="Pendiente">Pendiente de Pago</option>
                    <option value="Pagado">Pagado / Cobrado</option>
                    <option value="Anulado">Anulado</option>
                  </select>
                </div>
                {newBilling.estado_pago === 'Pagado' && (
                  <div className="form-group flex-grow">
                    <label>Fecha Real de Pago 💰</label>
                    <input type="date" className="form-control" value={newBilling.fecha_pago} onChange={(e) => setNewBilling({ ...newBilling, fecha_pago: e.target.value })} required />
                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Determina el mes en el Flujo de Caja</small>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Guardar Facturación</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR DATOS FACTURACION */}
      {showEditBillingModal && selectedBilling && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Ingresar Datos Facturación - OT {selectedBilling.ot_id}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowEditBillingModal(false); setSelectedBilling(null); }}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveBilling}>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Número de OC (Orden Compra)</label>
                  <input type="text" className="form-control" placeholder="Ej: OC-4560" value={selectedBilling.nro_oc} onChange={(e) => setSelectedBilling({ ...selectedBilling, nro_oc: e.target.value })} />
                </div>
                <div className="form-group flex-grow">
                  <label>Fecha Recepción OC</label>
                  <input type="date" className="form-control" value={selectedBilling.fecha_oc} onChange={(e) => setSelectedBilling({ ...selectedBilling, fecha_oc: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Número HES (Hoja Entrada Servicio)</label>
                <input type="text" className="form-control" placeholder="Ej: HES-77123" value={selectedBilling.nro_hes} onChange={(e) => setSelectedBilling({ ...selectedBilling, nro_hes: e.target.value })} />
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Número Factura SII</label>
                  <input type="text" className="form-control" placeholder="Ej: Factura 103" value={selectedBilling.nro_factura} onChange={(e) => setSelectedBilling({ ...selectedBilling, nro_factura: e.target.value })} />
                </div>
                <div className="form-group flex-grow">
                  <label>Fecha Emisión Factura</label>
                  <input type="date" className="form-control" value={selectedBilling.fecha_factura} onChange={(e) => setSelectedBilling({ ...selectedBilling, fecha_factura: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Fecha de Vencimiento de Factura (Dineros Futuros)</label>
                <input type="date" className="form-control" value={selectedBilling.fecha_vencimiento || ''} onChange={(e) => setSelectedBilling({ ...selectedBilling, fecha_vencimiento: e.target.value })} />
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Estado de Cobro / Pago</label>
                  <select className="form-control" value={selectedBilling.estado_pago} onChange={(e) => setSelectedBilling({ ...selectedBilling, estado_pago: e.target.value })}>
                    <option value="Pendiente">Pendiente de Pago</option>
                    <option value="Pagado">Pagado / Cobrado</option>
                    <option value="Anulado">Anulado</option>
                  </select>
                </div>
                {selectedBilling.estado_pago === 'Pagado' && (
                  <div className="form-group flex-grow">
                    <label>Fecha Real de Pago 💰</label>
                    <input type="date" className="form-control" value={selectedBilling.fecha_pago || ''} onChange={(e) => setSelectedBilling({ ...selectedBilling, fecha_pago: e.target.value })} required />
                    <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>Determina el mes en el Flujo de Caja</small>
                  </div>
                )}
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Guardar Facturación</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MARCAR PAGADO RAPIDAMENTE */}
      {showMarkPaidModal && billToMarkPaid && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>💰 Registrar Pago - OT {billToMarkPaid.ot_id}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowMarkPaidModal(false); setBillToMarkPaid(null); }}>Cerrar</button>
            </div>
            <form onSubmit={handleConfirmMarkPaid}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Confirmar que el cliente <strong>{billToMarkPaid.cliente_nombre}</strong> ha pagado la OT {billToMarkPaid.ot_id} (Monto Neto: ${Math.round(billToMarkPaid.monto_neto_presupuesto || 0).toLocaleString('es-CL')}).
              </p>
              <div className="form-group">
                <label>Fecha en que se acreditó el Pago *</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={paymentDate} 
                  onChange={(e) => setPaymentDate(e.target.value)} 
                  required 
                />
                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '0.25rem' }}>
                  El ingreso se contabilizará en el mes correspondiente a esta fecha dentro del Flujo de Caja.
                </small>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setShowMarkPaidModal(false); setBillToMarkPaid(null); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#10b981', borderColor: '#10b981' }}>Confirmar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR GASTO GENERAL */}
      {showEditGgModal && editingGeneralExpense && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '550px' }}>
            <div className="modal-header">
              <h3>✏️ Editar Gasto Fijo / Operacional</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowEditGgModal(false); setEditingGeneralExpense(null); }}>Cerrar</button>
            </div>
            <form onSubmit={handleUpdateGeneralExpense}>
              <div className="form-group">
                <label>Categoría / Familia Gasto</label>
                <select className="form-control" value={editingGeneralExpense.familia} onChange={(e) => setEditingGeneralExpense({ ...editingGeneralExpense, familia: e.target.value })}>
                  <option value="Arriendo">Arriendo Oficina/Taller</option>
                  <option value="Sueldos Base">Sueldos Fijos (Administrativos)</option>
                  <option value="Luz">Electricidad</option>
                  <option value="Agua">Agua Potable</option>
                  <option value="Internet">Internet y Comunicaciones</option>
                  <option value="Imposiciones">Imposiciones y Cotizaciones</option>
                  <option value="Contador">Honorarios Contador</option>
                  <option value="Combustible">Combustible General</option>
                  <option value="Gases">Gases Industriales (Biox/otros)</option>
                  <option value="Prestamo">Pago de Préstamo / Crédito</option>
                  <option value="Factoring">Factoring</option>
                  <option value="Iva">Pago de IVA (SII)</option>
                  <option value="Otros">Otros Egresos</option>
                </select>
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Fecha del Pago</label>
                  <input type="date" className="form-control" value={editingGeneralExpense.fecha} onChange={(e) => setEditingGeneralExpense({ ...editingGeneralExpense, fecha: e.target.value })} required />
                </div>
                <div className="form-group flex-grow">
                  <label>Monto Total ($)</label>
                  <input type="number" className="form-control" value={editingGeneralExpense.valor_total} onChange={(e) => setEditingGeneralExpense({ ...editingGeneralExpense, valor_total: e.target.value })} required />
                </div>
              </div>

              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Estado de Pago</label>
                  <select className="form-control" value={editingGeneralExpense.estado_pago} onChange={(e) => setEditingGeneralExpense({ ...editingGeneralExpense, estado_pago: e.target.value })}>
                    <option value="Pagado">Pagado</option>
                    <option value="Pendiente">Pendiente</option>
                  </select>
                </div>
                <div className="form-group flex-grow">
                  <label>Fecha Vencimiento (Si está Pendiente)</label>
                  <input type="date" className="form-control" value={editingGeneralExpense.fecha_vencimiento || ''} onChange={(e) => setEditingGeneralExpense({ ...editingGeneralExpense, fecha_vencimiento: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label>Detalle / Glosa del Egreso</label>
                <textarea className="form-control" rows="2" value={editingGeneralExpense.detalle} onChange={(e) => setEditingGeneralExpense({ ...editingGeneralExpense, detalle: e.target.value })} required></textarea>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Actualizar Egreso</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardContador;

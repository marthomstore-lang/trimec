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

  const [newGeneralExpense, setNewGeneralExpense] = useState({
    fecha: new Date().toISOString().split('T')[0],
    familia: 'Arriendo',
    detalle: '',
    valor_total: ''
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

  useEffect(() => {
    fetchData();
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

  const handleEditBilling = (bill) => {
    setSelectedBilling({
      ot_id: bill.ot_id,
      nro_oc: bill.nro_oc || '',
      fecha_oc: bill.fecha_oc || '',
      nro_hes: bill.nro_hes || '',
      nro_factura: bill.nro_factura || '',
      fecha_factura: bill.fecha_factura || '',
      estado_pago: bill.estado_pago || 'Pendiente'
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

  const handleCreateGeneralExpense = async (e) => {
    e.preventDefault();
    try {
      await api('/finanzas/gastos-generales', {
        method: 'POST',
        body: JSON.stringify({
          ...newGeneralExpense,
          valor_total: parseFloat(newGeneralExpense.valor_total)
        })
      });
      showToast('Gasto fijo registrado con éxito', 'success');
      setNewGeneralExpense({
        fecha: new Date().toISOString().split('T')[0],
        familia: 'Arriendo',
        detalle: '',
        valor_total: ''
      });
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

  const filteredBills = billingList.filter(bill => 
    bill.ot_id.toString().includes(searchQuery) ||
    bill.cliente_nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (bill.nro_oc && bill.nro_oc.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (bill.nro_factura && bill.nro_factura.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
              <div className="panel-header" style={{ marginBottom: '1.5rem' }}>
                <h3>Pipeline de Cobro de OTs</h3>
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
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.map((bill) => (
                      <tr key={bill.id}>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>OT {bill.ot_id}</td>
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
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleEditBilling(bill)}>
                              ✏️ Facturar
                            </button>
                            <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }} onClick={() => onSelectOt(bill.ot_id)}>
                              🔍
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
                            <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDeleteGeneralExpense(rec.id)}>
                              🗑️
                            </button>
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
              <div className="panel-header">
                <h3>Balance Financiero de Caja por Mes</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                Cruce de ingresos reales (OTs facturadas y cobradas) contra egresos fijos (arriendos, cuentas) y egresos de taller.
              </p>
              
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Ingresos Facturados (Neto)</th>
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

      {/* MODAL: EDITAR DATOS FACTURACION */}
      {showEditBillingModal && selectedBilling && (
        <div className="modal-overlay">
          <div className="modal-content">
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
                <label>Estado de Cobro / Pago</label>
                <select className="form-control" value={selectedBilling.estado_pago} onChange={(e) => setSelectedBilling({ ...selectedBilling, estado_pago: e.target.value })}>
                  <option value="Pendiente">Pendiente de Pago</option>
                  <option value="Pagado">Pagado / Cobrado</option>
                  <option value="Anulado">Anulado</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Guardar e Invoicing</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardContador;

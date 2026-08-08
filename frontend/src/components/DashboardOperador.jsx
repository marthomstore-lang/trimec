import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const DashboardOperador = ({ showToast }) => {
  const [ots, setOts] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('hh'); // 'hh', 'gastos', 'traslados'

  // Historiales locales (recientes)
  const [recentHh, setRecentHh] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentTravels, setRecentTravels] = useState([]);

  // Form States
  const [newHh, setNewHh] = useState({
    ot_id: '',
    trabajador_id: '',
    fecha: new Date().toISOString().split('T')[0],
    horas_normales: 8,
    horas_extra: 0,
    ubicacion: 'Taller',
    actividad: ''
  });

  const [newExpense, setNewExpense] = useState({
    ot_id: '',
    fecha: new Date().toISOString().split('T')[0],
    clasificacion: 'INSUMOS',
    detalle: '',
    cantidad: 1,
    valor_neto: '',
    foto_boleta: ''
  });

  const [newTravel, setNewTravel] = useState({
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

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const allOts = await api('/ots');
      const activeOts = allOts.filter(o => o.estado !== 'Facturada' && o.estado !== 'Cerrada');
      setOts(activeOts);

      const workersData = await api('/trabajadores');
      setWorkers(workersData);

      const allHh = await api('/hh');
      setRecentHh(allHh.slice(0, 10));

      const allExpenses = await api('/gastos');
      setRecentExpenses(allExpenses.slice(0, 10));
    } catch (err) {
      setError('Error al cargar datos básicos: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    document.title = 'Trimec - Portal Operador';
  }, []);

  useEffect(() => {
    if (activeTab === 'traslados' && ots.length > 0) {
      const loadRecentTravels = async () => {
        try {
          const firstOt = ots[0]?.id;
          if (firstOt) {
            const travels = await api(`/traslados/ot/${firstOt}`);
            setRecentTravels(travels);
          }
        } catch (e) {
          console.error(e);
        }
      };
      loadRecentTravels();
    }
  }, [activeTab, ots]);

  const handleRegisterHh = async (e) => {
    e.preventDefault();
    if (!newHh.ot_id || !newHh.trabajador_id) {
      showToast('Por favor, selecciona una OT y un Trabajador', 'warning');
      return;
    }
    try {
      await api('/hh', {
        method: 'POST',
        body: JSON.stringify({
          ...newHh,
          trabajador_id: parseInt(newHh.trabajador_id, 10),
          horas_normales: parseFloat(newHh.horas_normales),
          horas_extra: parseFloat(newHh.horas_extra)
        })
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
    if (!newExpense.ot_id) {
      showToast('Por favor, selecciona una OT', 'warning');
      return;
    }
    const net = parseFloat(newExpense.valor_neto) || 0;
    const iva = net * 0.19;
    const total = net + iva;

    try {
      await api('/gastos', {
        method: 'POST',
        body: JSON.stringify({
          ...newExpense,
          cantidad: parseFloat(newExpense.cantidad) || 1,
          valor_neto: net,
          valor_iva: iva,
          valor_total: total
        })
      });
      showToast('Gasto registrado con éxito', 'success');
      setNewExpense({
        ot_id: '',
        fecha: new Date().toISOString().split('T')[0],
        clasificacion: 'INSUMOS',
        detalle: '',
        cantidad: 1,
        valor_neto: '',
        foto_boleta: ''
      });
      fetchData();
    } catch (err) {
      showToast('Error al registrar gasto: ' + err.message, 'danger');
    }
  };

  const handleRegisterTravel = async (e) => {
    e.preventDefault();
    if (!newTravel.ot_id || !newTravel.trabajador_id) {
      showToast('Por favor, selecciona una OT y un Conductor/Trabajador', 'warning');
      return;
    }
    try {
      await api('/traslados', {
        method: 'POST',
        body: JSON.stringify({
          ...newTravel,
          trabajador_id: parseInt(newTravel.trabajador_id, 10),
          km_inicio: parseFloat(newTravel.km_inicio) || 0.0,
          km_termino: parseFloat(newTravel.km_termino) || 0.0
        })
      });
      showToast('Traslado registrado con éxito', 'success');
      
      const otId = newTravel.ot_id;
      setNewTravel({
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
      
      const travels = await api(`/traslados/ot/${otId}`);
      setRecentTravels(travels);
    } catch (err) {
      showToast('Error al registrar traslado: ' + err.message, 'danger');
    }
  };

  if (loading) return <div className="card text-center p-5"><p>Cargando panel de operador...</p></div>;

  return (
    <div className="container-fluid py-4" style={{ maxWidth: '1200px' }}>
      <div className="row mb-4">
        <div className="col">
          <h2 className="mb-1" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            Portal del Operario / Faenas
          </h2>
          <p className="text-muted">Ingreso rápido de datos en taller y terreno.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* TABS SELECTOR */}
      <div className="tabs-container mb-4">
        <button
          className={`tab-btn ${activeTab === 'hh' ? 'active' : ''}`}
          onClick={() => setActiveTab('hh')}
        >
          ⏱ Registrar HH (Horas)
        </button>
        <button
          className={`tab-btn ${activeTab === 'gastos' ? 'active' : ''}`}
          onClick={() => setActiveTab('gastos')}
        >
          💵 Registrar Gastos Faena
        </button>
        <button
          className={`tab-btn ${activeTab === 'traslados' ? 'active' : ''}`}
          onClick={() => setActiveTab('traslados')}
        >
          🚗 Registrar Viajes / Traslados
        </button>
      </div>

      <div className="row">
        {/* PANEL REGISTRO (IZQUIERDA) */}
        <div className="col-md-7 mb-4">
          <div className="card shadow-sm p-4">
            {activeTab === 'hh' && (
              <form onSubmit={handleRegisterHh}>
                <h4 className="mb-3" style={{ fontWeight: 600 }}>Registrar Horas de Trabajo Diarias</h4>
                
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Orden de Trabajo (OT Activa)</label>
                    <select
                      className="form-select"
                      value={newHh.ot_id}
                      onChange={e => setNewHh({ ...newHh, ot_id: e.target.value })}
                      required
                    >
                      <option value="">-- Seleccionar OT --</option>
                      {ots.map(o => (
                        <option key={o.id} value={o.id}>
                          OT-{o.id} ({o.detalle.substring(0, 40)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Trabajador</label>
                    <select
                      className="form-select"
                      value={newHh.trabajador_id}
                      onChange={e => setNewHh({ ...newHh, trabajador_id: e.target.value })}
                      required
                    >
                      <option value="">-- Seleccionar Trabajador --</option>
                      {workers.map(w => (
                        <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-4">
                    <label className="form-label">Fecha</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newHh.fecha}
                      onChange={e => setNewHh({ ...newHh, fecha: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Horas Normales</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={newHh.horas_normales}
                      onChange={e => setNewHh({ ...newHh, horas_normales: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Horas Extra</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={newHh.horas_extra}
                      onChange={e => setNewHh({ ...newHh, horas_extra: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Ubicación</label>
                    <div className="d-flex gap-3">
                      <label className="form-check-label d-flex align-items-center gap-1">
                        <input
                          type="radio"
                          name="hh_ubicacion"
                          className="form-check-input"
                          checked={newHh.ubicacion === 'Taller'}
                          onChange={() => setNewHh({ ...newHh, ubicacion: 'Taller' })}
                        />
                        Taller
                      </label>
                      <label className="form-check-label d-flex align-items-center gap-1">
                        <input
                          type="radio"
                          name="hh_ubicacion"
                          className="form-check-input"
                          checked={newHh.ubicacion === 'Terreno'}
                          onChange={() => setNewHh({ ...newHh, ubicacion: 'Terreno' })}
                        />
                        Terreno
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">¿Qué trabajo realizaste hoy? (Detalle ejecutado)</label>
                  <textarea
                    rows="3"
                    className="form-control"
                    placeholder="Describe brevemente las tareas ejecutadas..."
                    value={newHh.actividad}
                    onChange={e => setNewHh({ ...newHh, actividad: e.target.value })}
                    required
                  ></textarea>
                </div>

                <button type="submit" className="btn btn-primary w-100">
                  💾 Guardar Registro de Horas
                </button>
              </form>
            )}

            {activeTab === 'gastos' && (
              <form onSubmit={handleRegisterExpense}>
                <h4 className="mb-3" style={{ fontWeight: 600 }}>Registrar Gastos Diarios</h4>
                
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Orden de Trabajo (OT Activa)</label>
                    <select
                      className="form-select"
                      value={newExpense.ot_id}
                      onChange={e => setNewExpense({ ...newExpense, ot_id: e.target.value })}
                      required
                    >
                      <option value="">-- Seleccionar OT --</option>
                      {ots.map(o => (
                        <option key={o.id} value={o.id}>
                          OT-{o.id} ({o.detalle.substring(0, 40)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Tipo de Gasto</label>
                    <select
                      className="form-select"
                      value={newExpense.clasificacion}
                      onChange={e => setNewExpense({ ...newExpense, clasificacion: e.target.value })}
                      required
                    >
                      <option value="INSUMOS">Insumos</option>
                      <option value="Almuerzo">Almuerzo / Colación</option>
                      <option value="Combustible">Combustible</option>
                      <option value="Peaje">Peajes</option>
                      <option value="Plotteo">Plotteo / Impresión</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-4">
                    <label className="form-label">Fecha</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newExpense.fecha}
                      onChange={e => setNewExpense({ ...newExpense, fecha: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Cantidad</label>
                    <input
                      type="number"
                      className="form-control"
                      value={newExpense.cantidad}
                      onChange={e => setNewExpense({ ...newExpense, cantidad: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Monto Neto ($)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Valor sin IVA"
                      value={newExpense.valor_neto}
                      onChange={e => setNewExpense({ ...newExpense, valor_neto: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <label className="form-label">Detalle del Gasto</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej. Tornillos, Almuerzo personal Chillán, etc."
                    value={newExpense.detalle}
                    onChange={e => setNewExpense({ ...newExpense, detalle: e.target.value })}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="form-label">Foto Boleta (Path / URL Drive / Base64)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Inserta el path de la foto o link de Drive"
                    value={newExpense.foto_boleta}
                    onChange={e => setNewExpense({ ...newExpense, foto_boleta: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary w-100">
                  💾 Guardar Gasto
                </button>
              </form>
            )}

            {activeTab === 'traslados' && (
              <form onSubmit={handleRegisterTravel}>
                <h4 className="mb-3" style={{ fontWeight: 600 }}>Registrar Viajes y Kilometraje</h4>
                
                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Orden de Trabajo (OT Activa)</label>
                    <select
                      className="form-select"
                      value={newTravel.ot_id}
                      onChange={e => setNewTravel({ ...newTravel, ot_id: e.target.value })}
                      required
                    >
                      <option value="">-- Seleccionar OT --</option>
                      {ots.map(o => (
                        <option key={o.id} value={o.id}>
                          OT-{o.id} ({o.detalle.substring(0, 40)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Conductor / Técnico</label>
                    <select
                      className="form-select"
                      value={newTravel.trabajador_id}
                      onChange={e => setNewTravel({ ...newTravel, trabajador_id: e.target.value })}
                      required
                    >
                      <option value="">-- Seleccionar Conductor --</option>
                      {workers.map(w => (
                        <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-4">
                    <label className="form-label">Fecha Viaje</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newTravel.fecha}
                      onChange={e => setNewTravel({ ...newTravel, fecha: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Patente Vehículo</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ej. AB-CD-12"
                      value={newTravel.patente_vehiculo}
                      onChange={e => setNewTravel({ ...newTravel, patente_vehiculo: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Kilometraje Inicial</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      placeholder="Km al salir"
                      value={newTravel.km_inicio}
                      onChange={e => setNewTravel({ ...newTravel, km_inicio: e.target.value })}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Kilometraje Término</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      placeholder="Km al regresar"
                      value={newTravel.km_termino}
                      onChange={e => setNewTravel({ ...newTravel, km_termino: e.target.value })}
                    />
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Salida Taller (Hora)</label>
                    <input
                      type="time"
                      className="form-control"
                      value={newTravel.hora_salida_taller}
                      onChange={e => setNewTravel({ ...newTravel, hora_salida_taller: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Llegada Faena (Hora)</label>
                    <input
                      type="time"
                      className="form-control"
                      value={newTravel.hora_llegada_faena}
                      onChange={e => setNewTravel({ ...newTravel, hora_llegada_faena: e.target.value })}
                    />
                  </div>
                </div>

                <div className="row mb-3">
                  <div className="col-md-6">
                    <label className="form-label">Retorno Faena (Hora)</label>
                    <input
                      type="time"
                      className="form-control"
                      value={newTravel.hora_salida_faena}
                      onChange={e => setNewTravel({ ...newTravel, hora_salida_faena: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Llegada Taller (Hora)</label>
                    <input
                      type="time"
                      className="form-control"
                      value={newTravel.hora_llegada_taller}
                      onChange={e => setNewTravel({ ...newTravel, hora_llegada_taller: e.target.value })}
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">Detalle o Destino del Viaje</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ej. Traslado a Planta Yungay Arauco, etc."
                    value={newTravel.detalle_viaje}
                    onChange={e => setNewTravel({ ...newTravel, detalle_viaje: e.target.value })}
                  />
                </div>

                <button type="submit" className="btn btn-primary w-100">
                  💾 Guardar Viaje / Kilometraje
                </button>
              </form>
            )}
          </div>
        </div>

        {/* PANEL HISTORIAL RECIENTE (DERECHA) */}
        <div className="col-md-5">
          <div className="card shadow-sm p-4">
            <h4 className="mb-3" style={{ fontWeight: 600 }}>Tus Registros Recientes</h4>
            
            {activeTab === 'hh' && (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>OT</th>
                      <th>Horas</th>
                      <th>Actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentHh.map(r => (
                      <tr key={r.id}>
                        <td>{r.fecha}</td>
                        <td><strong>OT-{r.ot_id}</strong></td>
                        <td>{(r.horas_normales + r.horas_extra)} hrs</td>
                        <td>
                          <span style={{ fontSize: '0.8rem' }} title={r.actividad}>
                            {r.actividad?.substring(0, 20)}...
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recentHh.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center text-muted">No hay registros de horas.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'gastos' && (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>OT</th>
                      <th>Clasificación</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExpenses.map(r => (
                      <tr key={r.id}>
                        <td>{r.fecha}</td>
                        <td><strong>OT-{r.ot_id}</strong></td>
                        <td>{r.clasificacion}</td>
                        <td>
                          <span style={{ fontSize: '0.8rem' }}>
                            {r.detalle}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recentExpenses.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center text-muted">No hay registros de gastos.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'traslados' && (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Vehículo</th>
                      <th>Kms</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTravels.map(t => (
                      <tr key={t.id}>
                        <td>{t.fecha}</td>
                        <td><strong>{t.patente_vehiculo}</strong></td>
                        <td>{t.km_inicio} - {t.km_termino || '?'} km</td>
                        <td>
                          <span style={{ fontSize: '0.8rem' }}>
                            {t.detalle_viaje?.substring(0, 25)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recentTravels.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center text-muted">
                          No hay viajes recientes registrados para esta OT.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOperador;

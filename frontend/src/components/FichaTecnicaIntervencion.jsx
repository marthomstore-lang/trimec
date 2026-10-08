import React, { useState, useEffect, useRef } from 'react';
import api from '../utils/api';
import { saveOfflineItem } from '../utils/offlineStore';

const initialFormState = {
    activo_identificacion: '',
    fecha_inicio: new Date().toISOString().split('T')[0],
    hora_inicio_ejecucion: '',
    fecha_fin: new Date().toISOString().split('T')[0],
    hora_fin_ejecucion: '',
    tipo_mantenimiento: 'Preventivo',
    antes_condicion: '',
    despues_tareas: '',
    lecturas_parametros: {
        temperatura: '',
        vibracion: '',
        presion: '',
        voltaje: '',
        otros: ''
    },
    causa_raiz: '',
    estado_equipo: 'Operativo',
    tecnico_id: '',
    horas_mano_obra: {
        horas_normales: '',
        horas_extra: '0',
        ubicacion: 'Terreno'
    },
    registrar_hh_ot: false,
    repuestos_consumidos: [],
    descontar_inventario: false,
    recomendaciones: '',
    fotos_antes: [],
    fotos_despues: [],
    firma_nombre: '',
    firma_cargo: '',
    firma_digital: ''
};

export default function FichaTecnicaIntervencion({
    fixedOtId = null,
    initialReport = null,
    onSaved = null,
    onCancel = null,
    otsList = [],
    personalList = [],
    showToast = null
}) {
    const [selectedOtId, setSelectedOtId] = useState(fixedOtId ? String(fixedOtId) : '');
    const [ots, setOts] = useState(otsList);
    const [personal, setPersonal] = useState(personalList);
    const [activos, setActivos] = useState([]);
    const [inventario, setInventario] = useState([]);
    const [loadingReport, setLoadingReport] = useState(false);
    const [saving, setSaving] = useState(false);
    const [localMsg, setLocalMsg] = useState(null);

    const notify = (msg, type = 'info') => {
        if (showToast) {
            showToast(msg, type === 'error' ? 'danger' : type);
        } else {
            setLocalMsg({ msg, type });
            setTimeout(() => setLocalMsg(null), 5000);
        }
    };

    const [form, setForm] = useState(initialFormState);

    // Repuestos item builder
    const [repuestoMode, setRepuestoMode] = useState('bodega'); // 'bodega' | 'manual'
    const [selectedSku, setSelectedSku] = useState('');
    const [repuestoManualDesc, setRepuestoManualDesc] = useState('');
    const [repuestoCantidad, setRepuestoCantidad] = useState('1');
    const [repuestoUnidad, setRepuestoUnidad] = useState('UN');

    // Signature Canvas
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasCanvasStroke, setHasCanvasStroke] = useState(false);

    // Load lists if not provided
    useEffect(() => {
        const loadCatalogs = async () => {
            try {
                const promises = [
                    api('/activos').catch(() => []),
                    api('/inventario').catch(() => [])
                ];
                if (!otsList || otsList.length === 0) {
                    promises.push(api('/ots').catch(() => []));
                }
                if (!personalList || personalList.length === 0) {
                    promises.push(api('/trabajadores').catch(() => []));
                }

                const results = await Promise.all(promises);
                setActivos(Array.isArray(results[0]) ? results[0] : []);
                setInventario(Array.isArray(results[1]) ? results[1] : []);
                if (!otsList || otsList.length === 0) {
                    setOts(Array.isArray(results[2]) ? results[2].filter(o => o.estado !== 'Anulada') : []);
                }
                if (!personalList || personalList.length === 0) {
                    const pIdx = (!otsList || otsList.length === 0) ? 3 : 2;
                    setPersonal(Array.isArray(results[pIdx]) ? results[pIdx] : []);
                }
            } catch (e) {
                console.error('Error cargando catálogos en FichaTecnica:', e);
            }
        };
        loadCatalogs();
    }, []);

    useEffect(() => {
        if (otsList && otsList.length > 0) setOts(otsList);
    }, [otsList]);

    useEffect(() => {
        if (personalList && personalList.length > 0) setPersonal(personalList);
    }, [personalList]);

    // Populate from initialReport or fetch when selectedOtId changes
    useEffect(() => {
        if (fixedOtId) {
            setSelectedOtId(String(fixedOtId));
        }
    }, [fixedOtId]);

    const parseJsonField = (val, fallback) => {
        if (!val) return fallback;
        if (typeof val === 'object') return val;
        try {
            return JSON.parse(val);
        } catch {
            return fallback;
        }
    };

    const hydrateFormFromReport = (rep) => {
        if (!rep || !rep.id) {
            setForm({
                ...initialFormState,
                fecha_inicio: new Date().toISOString().split('T')[0],
                fecha_fin: new Date().toISOString().split('T')[0]
            });
            clearCanvas();
            return;
        }

        const parsedParams = parseJsonField(rep.lecturas_parametros, {});
        const parsedHh = parseJsonField(rep.horas_mano_obra, {});
        const parsedRepuestos = parseJsonField(rep.repuestos_consumidos, []);
        const parsedFotosAntes = parseJsonField(rep.fotos_antes, []);
        const parsedFotosDespues = parseJsonField(rep.fotos_despues, []);

        setForm({
            activo_identificacion: rep.activo_identificacion || '',
            fecha_inicio: rep.fecha_inicio || new Date().toISOString().split('T')[0],
            hora_inicio_ejecucion: rep.hora_inicio_ejecucion || '',
            fecha_fin: rep.fecha_fin || new Date().toISOString().split('T')[0],
            hora_fin_ejecucion: rep.hora_fin_ejecucion || '',
            tipo_mantenimiento: rep.tipo_mantenimiento || 'Preventivo',
            antes_condicion: rep.antes_condicion || '',
            despues_tareas: rep.despues_tareas || '',
            lecturas_parametros: {
                temperatura: parsedParams.temperatura || '',
                vibracion: parsedParams.vibracion || '',
                presion: parsedParams.presion || '',
                voltaje: parsedParams.voltaje || '',
                otros: parsedParams.otros || ''
            },
            causa_raiz: rep.causa_raiz || '',
            estado_equipo: rep.estado_equipo || 'Operativo',
            tecnico_id: rep.tecnico_id ? String(rep.tecnico_id) : '',
            horas_mano_obra: {
                horas_normales: parsedHh.horas_normales !== undefined ? String(parsedHh.horas_normales) : '',
                horas_extra: parsedHh.horas_extra !== undefined ? String(parsedHh.horas_extra) : '0',
                ubicacion: parsedHh.ubicacion || 'Terreno'
            },
            registrar_hh_ot: false,
            repuestos_consumidos: Array.isArray(parsedRepuestos) ? parsedRepuestos : [],
            descontar_inventario: false,
            recomendaciones: rep.recomendaciones || '',
            fotos_antes: Array.isArray(parsedFotosAntes) ? parsedFotosAntes : [],
            fotos_despues: Array.isArray(parsedFotosDespues) ? parsedFotosDespues : [],
            firma_nombre: rep.firma_nombre || '',
            firma_cargo: rep.firma_cargo || '',
            firma_digital: rep.firma_digital || ''
        });
    };

    useEffect(() => {
        if (initialReport && fixedOtId) {
            hydrateFormFromReport(initialReport);
            return;
        }
        if (!selectedOtId) {
            hydrateFormFromReport(null);
            return;
        }

        const fetchExistingReport = async () => {
            setLoadingReport(true);
            try {
                const data = await api(`/informes/ot/${selectedOtId}`);
                if (data && data.id) {
                    hydrateFormFromReport(data);
                } else {
                    hydrateFormFromReport(null);
                }
            } catch {
                hydrateFormFromReport(null);
            } finally {
                setLoadingReport(false);
            }
        };
        fetchExistingReport();
    }, [selectedOtId, initialReport]);

    // Auto-calculate hours when start and end time are entered
    useEffect(() => {
        if (form.fecha_inicio && form.hora_inicio_ejecucion && form.fecha_fin && form.hora_fin_ejecucion) {
            const start = new Date(`${form.fecha_inicio}T${form.hora_inicio_ejecucion}`);
            const end = new Date(`${form.fecha_fin}T${form.hora_fin_ejecucion}`);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
                const diffHours = ((end - start) / (1000 * 60 * 60)).toFixed(1);
                if (!form.horas_mano_obra.horas_normales) {
                    setForm(prev => ({
                        ...prev,
                        horas_mano_obra: {
                            ...prev.horas_mano_obra,
                            horas_normales: String(diffHours)
                        }
                    }));
                }
            }
        }
    }, [form.fecha_inicio, form.hora_inicio_ejecucion, form.fecha_fin, form.hora_fin_ejecucion]);

    // Handle photo uploads (convert to compressed Base64 so backend uploads directly to Google Drive OT folder)
    const handlePhotoUpload = async (e, tipo) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const readAndCompress = (file) => new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const maxDim = 1280;
                    let width = img.width;
                    let height = img.height;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => resolve(event.target.result);
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });

        const base64List = await Promise.all(files.map(readAndCompress));
        setForm(prev => ({
            ...prev,
            [tipo]: [...prev[tipo], ...base64List]
        }));
        e.target.value = '';
    };

    const removePhoto = (tipo, index) => {
        setForm(prev => ({
            ...prev,
            [tipo]: prev[tipo].filter((_, i) => i !== index)
        }));
    };

    // Add Repuesto Consumido
    const handleAddRepuesto = () => {
        const cant = parseFloat(repuestoCantidad);
        if (!cant || cant <= 0) {
            notify('Ingrese una cantidad válida', 'warning');
            return;
        }

        if (repuestoMode === 'bodega') {
            if (!selectedSku) {
                notify('Seleccione un repuesto o material del inventario', 'warning');
                return;
            }
            const item = inventario.find(i => i.sku === selectedSku);
            if (!item) return;

            setForm(prev => ({
                ...prev,
                repuestos_consumidos: [
                    ...prev.repuestos_consumidos,
                    {
                        sku: item.sku,
                        descripcion: item.descripcion,
                        cantidad: cant,
                        unidad: item.unidad_medida || 'UN',
                        ya_descontado: false
                    }
                ]
            }));
            setSelectedSku('');
            setRepuestoCantidad('1');
        } else {
            if (!repuestoManualDesc.trim()) {
                notify('Ingrese la descripción o código del material utilizado', 'warning');
                return;
            }
            setForm(prev => ({
                ...prev,
                repuestos_consumidos: [
                    ...prev.repuestos_consumidos,
                    {
                        sku: 'MANUAL',
                        descripcion: repuestoManualDesc.trim(),
                        cantidad: cant,
                        unidad: repuestoUnidad || 'UN',
                        ya_descontado: true
                    }
                ]
            }));
            setRepuestoManualDesc('');
            setRepuestoCantidad('1');
        }
    };

    const handleRemoveRepuesto = (idx) => {
        setForm(prev => ({
            ...prev,
            repuestos_consumidos: prev.repuestos_consumidos.filter((_, i) => i !== idx)
        }));
    };

    // Canvas Signature Handlers
    const getPos = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e) => {
        if (e.cancelable) e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getPos(e);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
        setHasCanvasStroke(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getPos(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const endDrawing = () => {
        if (!isDrawing) return;
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (canvas && hasCanvasStroke) {
            setForm(prev => ({
                ...prev,
                firma_digital: canvas.toDataURL('image/png')
            }));
        }
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        setHasCanvasStroke(false);
        setForm(prev => ({ ...prev, firma_digital: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const targetOtId = fixedOtId || selectedOtId;
        if (!targetOtId) {
            notify('Debe seleccionar una Orden de Trabajo (OT)', 'warning');
            return;
        }
        if (!form.despues_tareas.trim()) {
            notify('Debe ingresar la descripción de la actividad ejecutada', 'warning');
            return;
        }

        setSaving(true);
        const payload = {
            ...form,
            tecnico_id: form.tecnico_id ? parseInt(form.tecnico_id, 10) : null
        };

        try {
            if (!navigator.onLine) {
                await saveOfflineItem({
                    type: 'INFORME_TECNICO',
                    endpoint: `/informes/ot/${targetOtId}`,
                    method: 'POST',
                    payload,
                    label: `Ficha Técnica OT #${targetOtId} (${form.tipo_mantenimiento} - ${form.estado_equipo})`
                });
                notify('📦 Sin señal: Ficha Técnica guardada en el teléfono para sincronizar luego.', 'info');
                if (onSaved) onSaved(payload);
                setSaving(false);
                return;
            }

            const data = await api(`/informes/ot/${targetOtId}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            notify('✅ Ficha Técnica y respaldo fotográfico en Google Drive guardados con éxito', 'success');
            if (data && data.report) {
                hydrateFormFromReport(data.report);
            }
            if (onSaved) onSaved((data && data.report) || payload);
        } catch (error) {
            await saveOfflineItem({
                type: 'INFORME_TECNICO',
                endpoint: `/informes/ot/${targetOtId}`,
                method: 'POST',
                payload,
                label: `Ficha Técnica OT #${targetOtId} (${form.tipo_mantenimiento})`
            });
            notify('📦 Red inestable o error de conexión: Ficha Técnica guardada localmente para sincronizar.', 'info');
            if (onSaved) onSaved(payload);
        } finally {
            setSaving(false);
        }
    };

    const currentOt = ots.find(o => String(o.id) === String(selectedOtId));

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {localMsg && (
                <div style={{
                    padding: '0.85rem 1.25rem',
                    borderRadius: '10px',
                    background: localMsg.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : localMsg.type === 'warning' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                    border: `1px solid ${localMsg.type === 'success' ? '#10b981' : localMsg.type === 'warning' ? '#f59e0b' : '#3b82f6'}`,
                    color: '#fff',
                    fontWeight: 600
                }}>
                    {localMsg.msg}
                </div>
            )}
            {/* Banner informativo */}
            <div style={{
                background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(16, 185, 129, 0.12))',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem'
            }}>
                <div>
                    <h3 style={{ margin: 0, color: '#60a5fa', fontSize: '1.15rem' }}>
                        📋 Ficha de Intervención Técnica y Conformidad
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Registro estandarizado de activo, parámetros cuantitativos, repuestos, horas hombre y fotos (sincronizadas en la carpeta Google Drive de la OT).
                    </p>
                </div>
                {loadingReport && (
                    <span className="badge badge-info">Cargando datos previos de la OT...</span>
                )}
            </div>

            {/* ================================================================= */}
            {/* SECCIÓN 1: DATOS DE IDENTIFICACIÓN Y ESTADO                       */}
            {/* ================================================================= */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>1️⃣</span> Datos de Identificación y Estado
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    {/* 1.1 Número de Orden de Trabajo */}
                    {!fixedOtId ? (
                        <div>
                            <label className="form-label">Número de Orden de Trabajo (OT) *</label>
                            <select
                                className="form-input"
                                required
                                value={selectedOtId}
                                onChange={e => setSelectedOtId(e.target.value)}
                            >
                                <option value="">-- Seleccione Orden de Trabajo --</option>
                                {ots.map(o => (
                                    <option key={o.id} value={o.id}>
                                        {o.codigo || `OT-${o.id}`} — {o.cliente} ({o.titulo || o.descripcion?.slice(0, 35) || 'Sin título'})
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div>
                            <label className="form-label">Orden de Trabajo Asignada</label>
                            <input
                                type="text"
                                className="form-input"
                                disabled
                                value={currentOt ? `${currentOt.codigo || `OT-${fixedOtId}`} - ${currentOt.cliente}` : `OT #${fixedOtId}`}
                                style={{ opacity: 0.8 }}
                            />
                        </div>
                    )}

                    {/* 1.2 Identificación del Activo */}
                    <div>
                        <label className="form-label">Identificación del Activo (Equipo / Serie / Código) *</label>
                        <input
                            type="text"
                            list="catalogo-activos-list"
                            className="form-input"
                            required
                            placeholder="Ej: Compresor Atlas Copco GA37 - Serie #A9942"
                            value={form.activo_identificacion}
                            onChange={e => setForm({ ...form, activo_identificacion: e.target.value })}
                        />
                        <datalist id="catalogo-activos-list">
                            {activos.map(a => (
                                <option
                                    key={a.id}
                                    value={`${a.codigo_interno || `ACT-${a.id}`} | ${a.nombre} ${a.marca ? `(${a.marca} ${a.modelo || ''})` : ''} ${a.numero_serie ? `- S/N: ${a.numero_serie}` : ''}`.trim()}
                                />
                            ))}
                        </datalist>
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                            Seleccione un activo registrado o escriba nombre, código o serie manualmente.
                        </small>
                    </div>

                    {/* 1.3 Tipo de Mantenimiento */}
                    <div>
                        <label className="form-label">Tipo de Mantenimiento *</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {['Preventivo', 'Correctivo (Avería)', 'Predictivo'].map(tipo => {
                                const active = form.tipo_mantenimiento === tipo;
                                return (
                                    <button
                                        key={tipo}
                                        type="button"
                                        onClick={() => setForm({ ...form, tipo_mantenimiento: tipo })}
                                        style={{
                                            flex: 1,
                                            padding: '0.6rem 0.5rem',
                                            borderRadius: '8px',
                                            border: active ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                                            background: active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.03)',
                                            color: active ? '#60a5fa' : 'var(--text-main)',
                                            fontWeight: active ? 700 : 500,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {tipo === 'Preventivo' && '🛡️ '}
                                        {tipo === 'Correctivo (Avería)' && '🔧 '}
                                        {tipo === 'Predictivo' && '📈 '}
                                        {tipo}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* 1.4 Fecha y Hora de Inicio y Finalización */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(255,255,255,0.07)'
                }}>
                    <div>
                        <label className="form-label">Fecha de Inicio *</label>
                        <input
                            type="date"
                            className="form-input"
                            required
                            value={form.fecha_inicio}
                            onChange={e => setForm({ ...form, fecha_inicio: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">Hora de Inicio *</label>
                        <input
                            type="time"
                            className="form-input"
                            required
                            value={form.hora_inicio_ejecucion}
                            onChange={e => setForm({ ...form, hora_inicio_ejecucion: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">Fecha de Finalización *</label>
                        <input
                            type="date"
                            className="form-input"
                            required
                            value={form.fecha_fin}
                            onChange={e => setForm({ ...form, fecha_fin: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">Hora de Finalización *</label>
                        <input
                            type="time"
                            className="form-input"
                            required
                            value={form.hora_fin_ejecucion}
                            onChange={e => setForm({ ...form, hora_fin_ejecucion: e.target.value })}
                        />
                    </div>
                </div>

                {/* 1.5 Respaldo Fotográfico del Antes y Después */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '1rem',
                    marginTop: '1.25rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(255,255,255,0.07)'
                }}>
                    {/* FOTOS ANTES */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px', border: '1px dashed rgba(245, 158, 11, 0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <strong style={{ color: '#fbbf24', fontSize: '0.9rem' }}>📷 Respaldo Fotográfico ANTES</strong>
                            <span className="badge badge-warning">{form.fotos_antes.length} foto(s)</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                            Estado inicial del equipo antes de intervenir. Se guardará en la carpeta Drive de la OT.
                        </p>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            capture="environment"
                            onChange={e => handlePhotoUpload(e, 'fotos_antes')}
                            className="form-input"
                            style={{ fontSize: '0.82rem', padding: '0.45rem' }}
                        />
                        {form.fotos_antes.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                                {form.fotos_antes.map((foto, i) => (
                                    <div key={i} style={{ position: 'relative', width: '74px', height: '74px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                                        {String(foto).startsWith('data:image') ? (
                                            <img src={foto} alt={`Antes ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <a
                                                href={foto}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#1e293b', color: '#60a5fa', fontSize: '0.7rem', textAlign: 'center', textDecoration: 'none', padding: '4px' }}
                                            >
                                                ☁️ Drive #{i + 1}
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removePhoto('fotos_antes', i)}
                                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', cursor: 'pointer', lineHeight: 1 }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* FOTOS DESPUÉS */}
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px', border: '1px dashed rgba(16, 185, 129, 0.4)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <strong style={{ color: '#34d399', fontSize: '0.9rem' }}>📸 Respaldo Fotográfico DESPUÉS</strong>
                            <span className="badge badge-success">{form.fotos_despues.length} foto(s)</span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.75rem 0' }}>
                            Resultado final del equipo tras la intervención. Se guardará en la carpeta Drive de la OT.
                        </p>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            capture="environment"
                            onChange={e => handlePhotoUpload(e, 'fotos_despues')}
                            className="form-input"
                            style={{ fontSize: '0.82rem', padding: '0.45rem' }}
                        />
                        {form.fotos_despues.length > 0 && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                                {form.fotos_despues.map((foto, i) => (
                                    <div key={i} style={{ position: 'relative', width: '74px', height: '74px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                                        {String(foto).startsWith('data:image') ? (
                                            <img src={foto} alt={`Después ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <a
                                                href={foto}
                                                target="_blank"
                                                rel="noreferrer"
                                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#1e293b', color: '#34d399', fontSize: '0.7rem', textAlign: 'center', textDecoration: 'none', padding: '4px' }}
                                            >
                                                ☁️ Drive #{i + 1}
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removePhoto('fotos_despues', i)}
                                            style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239,68,68,0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '0.7rem', cursor: 'pointer', lineHeight: 1 }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* SECCIÓN 2: DATOS DE LA EJECUCIÓN                                  */}
            {/* ================================================================= */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #f59e0b' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>2️⃣</span> Datos de la Ejecución
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label className="form-label">Condición Inicial Encontrada (Diagnóstico Antes)</label>
                        <textarea
                            className="form-input"
                            rows="3"
                            placeholder="Ej: Equipo presentaba fuga en sello mecánico, ruidos anormales en rodamiento lado acople..."
                            value={form.antes_condicion}
                            onChange={e => setForm({ ...form, antes_condicion: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="form-label">Descripción de la Actividad Realizada *</label>
                        <textarea
                            className="form-input"
                            rows="3"
                            required
                            placeholder="Detalle de acciones realizadas: revisión, ajuste, limpieza, alineación o sustitución de componentes..."
                            value={form.despues_tareas}
                            onChange={e => setForm({ ...form, despues_tareas: e.target.value })}
                        />
                    </div>
                </div>

                {/* 2.2 Lecturas de Parámetros Cuantitativos */}
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <label className="form-label" style={{ color: '#e2e8f0', marginBottom: '0.6rem', display: 'block' }}>
                        🌡️ Lecturas de Parámetros Cuantitativos (Opcional)
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Temperatura (°C)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: 68 °C"
                                value={form.lecturas_parametros.temperatura}
                                onChange={e => setForm({
                                    ...form,
                                    lecturas_parametros: { ...form.lecturas_parametros, temperatura: e.target.value }
                                })}
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Vibración (mm/s)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: 2.4 mm/s"
                                value={form.lecturas_parametros.vibracion}
                                onChange={e => setForm({
                                    ...form,
                                    lecturas_parametros: { ...form.lecturas_parametros, vibracion: e.target.value }
                                })}
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Presión (Bar / PSI)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: 7.5 Bar / 110 PSI"
                                value={form.lecturas_parametros.presion}
                                onChange={e => setForm({
                                    ...form,
                                    lecturas_parametros: { ...form.lecturas_parametros, presion: e.target.value }
                                })}
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Voltaje / Corriente (V / A)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: 380V / 24.5A"
                                value={form.lecturas_parametros.voltaje}
                                onChange={e => setForm({
                                    ...form,
                                    lecturas_parametros: { ...form.lecturas_parametros, voltaje: e.target.value }
                                })}
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Otros Parámetros (RPM, Caudal)</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: 1480 RPM"
                                value={form.lecturas_parametros.otros}
                                onChange={e => setForm({
                                    ...form,
                                    lecturas_parametros: { ...form.lecturas_parametros, otros: e.target.value }
                                })}
                            />
                        </div>
                    </div>
                </div>

                {/* 2.3 Causa Raíz y 2.4 Estado del Equipo */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                    gap: '1rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid rgba(255,255,255,0.07)'
                }}>
                    <div>
                        <label className="form-label">Código de Falla o Causa Raíz</label>
                        <input
                            type="text"
                            list="causas-raiz-list"
                            className="form-input"
                            placeholder="Ej: Desgaste por fatiga / Falta de lubricación / Sobrecarga eléctrica"
                            value={form.causa_raiz}
                            onChange={e => setForm({ ...form, causa_raiz: e.target.value })}
                        />
                        <datalist id="causas-raiz-list">
                            <option value="MANT-PREV: Mantenimiento preventivo programado (Sin falla)" />
                            <option value="MEC-01: Desgaste natural de componentes mecánicos" />
                            <option value="MEC-02: Falla de rodamiento / falta de lubricación" />
                            <option value="MEC-03: Desalineación o desbalanceo mecánico" />
                            <option value="HID-01: Fuga en sellos, retenes o mangueras hidráulicas" />
                            <option value="ELE-01: Sobrecarga eléctrica / falla de aislamiento" />
                            <option value="OPE-01: Error de operación o sobrecarga de trabajo" />
                        </datalist>
                    </div>

                    <div>
                        <label className="form-label">Estado Final del Equipo *</label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                            {[
                                { label: 'Operativo', icon: '✅', color: '#10b981' },
                                { label: 'En Pruebas', icon: '⚠️', color: '#f59e0b' },
                                { label: 'Fuera de Servicio', icon: '⛔', color: '#ef4444' }
                            ].map(st => {
                                const active = form.estado_equipo === st.label;
                                return (
                                    <button
                                        key={st.label}
                                        type="button"
                                        onClick={() => setForm({ ...form, estado_equipo: st.label })}
                                        style={{
                                            flex: 1,
                                            padding: '0.6rem 0.4rem',
                                            borderRadius: '8px',
                                            border: active ? `2px solid ${st.color}` : '1px solid var(--border-color)',
                                            background: active ? `${st.color}25` : 'rgba(255,255,255,0.03)',
                                            color: active ? st.color : 'var(--text-main)',
                                            fontWeight: active ? 700 : 500,
                                            fontSize: '0.8rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {st.icon} {st.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* SECCIÓN 3: RECURSOS Y VALIDACIÓN                                  */}
            {/* ================================================================= */}
            <div className="glass-panel" style={{ padding: '1.25rem', borderLeft: '4px solid #10b981' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>3️⃣</span> Recursos y Validación
                </h4>

                {/* 3.1 Horas de Mano de Obra */}
                <div style={{ background: 'rgba(0,0,0,0.18)', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#e2e8f0', fontSize: '0.92rem' }}>⏱️ Horas de Mano de Obra</strong>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#60a5fa', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={form.registrar_hh_ot}
                                onChange={e => setForm({ ...form, registrar_hh_ot: e.target.checked })}
                            />
                            Imputar automáticamente estas horas al costo HH de la OT
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Técnico Responsable</label>
                            <select
                                className="form-input"
                                value={form.tecnico_id}
                                onChange={e => setForm({ ...form, tecnico_id: e.target.value })}
                            >
                                <option value="">-- Seleccionar Técnico --</option>
                                {personal.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre} ({p.especialidad || p.rol})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Horas Normales Invertidas</label>
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                className="form-input"
                                placeholder="Ej: 4.5"
                                value={form.horas_mano_obra.horas_normales}
                                onChange={e => setForm({
                                    ...form,
                                    horas_mano_obra: { ...form.horas_mano_obra, horas_normales: e.target.value }
                                })}
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Horas Extra (50%)</label>
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                className="form-input"
                                placeholder="0"
                                value={form.horas_mano_obra.horas_extra}
                                onChange={e => setForm({
                                    ...form,
                                    horas_mano_obra: { ...form.horas_mano_obra, horas_extra: e.target.value }
                                })}
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.78rem' }}>Modalidad / Ubicación</label>
                            <select
                                className="form-input"
                                value={form.horas_mano_obra.ubicacion}
                                onChange={e => setForm({
                                    ...form,
                                    horas_mano_obra: { ...form.horas_mano_obra, ubicacion: e.target.value }
                                })}
                            >
                                <option value="Terreno">Terreno (Planta Cliente)</option>
                                <option value="Taller">Taller Trimec</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* 3.2 Repuestos y Materiales Consumidos */}
                <div style={{ background: 'rgba(0,0,0,0.18)', padding: '1rem', borderRadius: '10px', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <strong style={{ color: '#e2e8f0', fontSize: '0.92rem' }}>🔩 Repuestos y Materiales Consumidos</strong>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#34d399', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={form.descontar_inventario}
                                onChange={e => setForm({ ...form, descontar_inventario: e.target.checked })}
                            />
                            Descontar automáticamente de Bodega los ítems con SKU
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <button
                            type="button"
                            className={`btn ${repuestoMode === 'bodega' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => setRepuestoMode('bodega')}
                        >
                            📦 Desde Inventario / Bodega
                        </button>
                        <button
                            type="button"
                            className={`btn ${repuestoMode === 'manual' ? 'btn-primary' : ''}`}
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                            onClick={() => setRepuestoMode('manual')}
                        >
                            ✍️ Ingreso Manual (Insumo externo)
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        {repuestoMode === 'bodega' ? (
                            <div style={{ flex: 3, minWidth: '220px' }}>
                                <label className="form-label" style={{ fontSize: '0.75rem' }}>Seleccionar Pieza / Lubricante de Bodega</label>
                                <select
                                    className="form-input"
                                    value={selectedSku}
                                    onChange={e => setSelectedSku(e.target.value)}
                                >
                                    <option value="">-- Seleccione repuesto o insumo --</option>
                                    {inventario.map(item => (
                                        <option key={item.id} value={item.sku}>
                                            [{item.sku}] {item.descripcion} (Stock: {item.stock_actual} {item.unidad_medida || 'UN'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            <>
                                <div style={{ flex: 3, minWidth: '200px' }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Código y Nombre del Repuesto / Lubricante</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="Ej: Rodamiento SKF 6205-2RS / Grasa Litio EP2"
                                        value={repuestoManualDesc}
                                        onChange={e => setRepuestoManualDesc(e.target.value)}
                                    />
                                </div>
                                <div style={{ width: '90px' }}>
                                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Unidad</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={repuestoUnidad}
                                        onChange={e => setRepuestoUnidad(e.target.value)}
                                    />
                                </div>
                            </>
                        )}

                        <div style={{ width: '100px' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Cantidad</label>
                            <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                className="form-input"
                                value={repuestoCantidad}
                                onChange={e => setRepuestoCantidad(e.target.value)}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleAddRepuesto}
                            className="btn btn-primary"
                            style={{ padding: '0.6rem 1rem', height: '40px' }}
                        >
                            + Agregar
                        </button>
                    </div>

                    {form.repuestos_consumidos.length > 0 && (
                        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {form.repuestos_consumidos.map((rep, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        background: 'rgba(255,255,255,0.04)',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <span>
                                        <strong style={{ color: '#60a5fa' }}>[{rep.sku || 'S/C'}]</strong> {rep.descripcion} —{' '}
                                        <strong>{rep.cantidad} {rep.unidad || 'UN'}</strong>
                                        {rep.ya_descontado && rep.sku !== 'MANUAL' && (
                                            <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>Descontado</span>
                                        )}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveRepuesto(idx)}
                                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                                    >
                                        ✕ Quitar
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 3.3 Observaciones y Recomendaciones */}
                <div style={{ marginBottom: '1rem' }}>
                    <label className="form-label">Observaciones y Recomendaciones Técnicas</label>
                    <textarea
                        className="form-input"
                        rows="3"
                        placeholder="Notas sobre anomalías pendientes, repuestos a cotizar o futuras intervenciones necesarias..."
                        value={form.recomendaciones}
                        onChange={e => setForm({ ...form, recomendaciones: e.target.value })}
                    />
                </div>

                {/* 3.4 Firma o Conformidad */}
                <div style={{
                    background: 'rgba(0,0,0,0.22)',
                    padding: '1rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                    <strong style={{ color: '#34d399', fontSize: '0.95rem', display: 'block', marginBottom: '0.75rem' }}>
                        ✍️ Firma o Conformidad del Responsable / Cliente
                    </strong>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Nombre de quien valida / recepciona</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: Carlos Muñoz - Jefe de Planta"
                                value={form.firma_nombre}
                                onChange={e => setForm({ ...form, firma_nombre: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Cargo / Área / RUT</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ej: Supervisor de Mantenimiento Cliente"
                                value={form.firma_cargo}
                                onChange={e => setForm({ ...form, firma_cargo: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', margin: 0 }}>
                                Firma Digital en Pantalla (Dibuje con el dedo o mouse)
                            </label>
                            <button
                                type="button"
                                onClick={clearCanvas}
                                style={{
                                    background: 'rgba(239,68,68,0.15)',
                                    color: '#f87171',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: '6px',
                                    padding: '0.2rem 0.6rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer'
                                }}
                            >
                                🗑️ Limpiar Firma
                            </button>
                        </div>

                        <div style={{
                            background: '#ffffff',
                            borderRadius: '8px',
                            border: '2px solid #94a3b8',
                            overflow: 'hidden',
                            touchAction: 'none'
                        }}>
                            <canvas
                                ref={canvasRef}
                                width={600}
                                height={160}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={endDrawing}
                                onMouseLeave={endDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={endDrawing}
                                style={{ width: '100%', height: '140px', display: 'block', cursor: 'crosshair' }}
                            />
                        </div>

                        {form.firma_digital && !hasCanvasStroke && (
                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '0.78rem', color: '#34d399' }}>✔ Firma registrada previamente:</span>
                                <img
                                    src={form.firma_digital}
                                    alt="Firma registrada"
                                    style={{ height: '48px', background: '#fff', padding: '4px', borderRadius: '6px' }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Botones de Acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                {onCancel && (
                    <button
                        type="button"
                        className="btn"
                        style={{ background: 'rgba(255,255,255,0.08)' }}
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                    style={{
                        background: 'linear-gradient(135deg, #2563eb, #10b981)',
                        padding: '0.85rem 1.75rem',
                        fontSize: '1rem',
                        fontWeight: 700
                    }}
                >
                    {saving ? '⏳ Guardando y subiendo fotos a Drive...' : '💾 Guardar Ficha de Intervención Técnica'}
                </button>
            </div>
        </form>
    );
}

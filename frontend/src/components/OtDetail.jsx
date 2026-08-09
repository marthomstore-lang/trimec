import React, { useState, useEffect } from 'react';
import api, { BASE_URL } from '../utils/api';

const DEFAULT_NOTAS = `1.- Solo se aceptará como válida, la cotización enviada en formato PDF
2.- Este presupuesto tiene una validez de cinco días hábiles, posteriores a eso se deberan recotizar Item N° 2 y 3
3.- La aprobación de presupuesto debera venir acompañada de la correspondiente Orden de Compra pedido o solicitud de pedido, según corresponda.
4.- Garantía por 3 meses.
5.- Jornada de trabajo
5.1.- Horario ordinario : Lunes a Jueves de 08:15am a 17:45pm / Viernes 08:15am a 14:00pm.-
5.2.- Horario extraordinario programado con al menos 48 horas de anticipación: Lunes a Jueves de 17:46pm a 08:15am / Viernes 14:01pm, sabi
5.3.- Llamado de emergencia, domingos y festivos, recargo del 100% por sobre la hora normal.-
6.- Se considera llamado de EMERGENCIA, solicitud de atención inmediata y/o durante el presente día en curso.`;

const DEFAULT_PLANTILLAS = [
  {
    id: 'bucalemu_std',
    name: '📌 1. Estándar Faena Bucalemu',
    faena: 'FAENA BUCALEMU.-',
    notas: DEFAULT_NOTAS
  },
  {
    id: 'cholguan_transporte',
    name: '📌 2. Faena Cholguán (Con Peajes y Transportes)',
    faena: 'FAENA CHOLGUAN.-',
    notas: `1.- Presupuesto válido solo en formato PDF enviado por Trimec SpA.
2.- Validez de la oferta: 5 días hábiles a contar de la fecha de emisión.
3.- Requisito indispensable: Orden de Compra o Solicitud de Pedido autorizada previa al inicio del trabajo.
4.- Incluye traslados, peajes y kilometraje tramo Cholguán - Bucalemu.
5.- Garantía de trabajos y repuestos: 3 meses contra fallas de fabricación o montaje.
6.- Horario ordinario: Lunes a Jueves 08:15 a 17:45 hrs / Viernes 08:15 a 14:00 hrs.
7.- Trabajos fuera de horario o días festivos con recargo del 100%.`
  },
  {
    id: 'taller_maestranza',
    name: '📌 3. Servicios en Taller / Maestranza (Sin Flete)',
    faena: 'MAESTRANZA CAMPANARIO.-',
    notas: `1.- Cotización válida únicamente en formato PDF enviado por correo corporativo.
2.- Presupuesto válido por 7 días corridos.
3.- Los trabajos se ejecutarán en dependencias de Maestranza Trimec SpA (Campanario).
4.- El retiro y transporte de las piezas o componentes corren por cuenta del cliente salvo indicación contraria.
5.- Garantía de fabricación y mecanizado: 3 meses.
6.- Pago contra recepción conforme e informe técnico de entrega.`
  },
  {
    id: 'emergencia_247',
    name: '⚡ 4. Atenciones de Emergencia 24/7 (Recargo 100%)',
    faena: 'FAENA EMERGENCIA 24/7.-',
    notas: `1.- Presupuesto de atención prioritaria inmediata (Llamado de Emergencia).
2.- Validez de la cotización: 48 horas.
3.- Todos los trabajos realizados en horario nocturno, domingos y festivos aplican un recargo del 100% en HH.
4.- El cliente deberá proveer autorización formal o correo de respaldo previo al despliegue del equipo técnico.
5.- Garantía del servicio: 3 meses bajo condiciones normales de operación.`
  }
];

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

  // Notes & Faena Modal State
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesForm, setNotesForm] = useState({ faena: '', notas_presupuesto: '' });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customTemplates, setCustomTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem('trimec_notas_plantillas');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Custom Popups (Modals) State - Replacing native browser prompt/confirm
  const [showSaveTplModal, setShowSaveTplModal] = useState(false);
  const [newTplName, setNewTplName] = useState('');

  const [showEditTplModal, setShowEditTplModal] = useState(false);
  const [editingTplData, setEditingTplData] = useState({ id: '', name: '', faena: '', notas: '' });

  const [showDeleteTplModal, setShowDeleteTplModal] = useState(false);
  const [deletingTplId, setDeletingTplId] = useState('');

  const handleSelectTemplate = (templateId) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const allTemplates = [...DEFAULT_PLANTILLAS, ...customTemplates];
    const found = allTemplates.find(t => t.id === templateId);
    if (found) {
      setNotesForm({
        faena: found.faena,
        notas_presupuesto: found.notas
      });
      showToast(`Cargada plantilla: "${found.name.replace(/^[📌⚡⭐]\s*/, '')}"`, 'info');
    }
  };

  const handleOpenSaveModal = () => {
    setNewTplName('');
    setShowSaveTplModal(true);
  };

  const handleConfirmSaveNewTemplate = (e) => {
    e.preventDefault();
    if (!newTplName || !newTplName.trim()) return;
    
    const cleanName = newTplName.trim();
    const newTpl = {
      id: 'custom_' + Date.now(),
      name: `⭐ ${cleanName}`,
      faena: notesForm.faena,
      notas: notesForm.notas_presupuesto,
      isCustom: true
    };
    
    const updated = [...customTemplates, newTpl];
    setCustomTemplates(updated);
    localStorage.setItem('trimec_notas_plantillas', JSON.stringify(updated));
    setSelectedTemplateId(newTpl.id);
    setShowSaveTplModal(false);
    showToast(`Plantilla "${cleanName}" guardada exitosamente`, 'success');
  };

  const handleOpenEditModal = () => {
    const allTemplates = [...DEFAULT_PLANTILLAS, ...customTemplates];
    const found = allTemplates.find(t => t.id === selectedTemplateId);
    if (found) {
      setEditingTplData({
        id: found.id,
        name: found.name.replace(/^[📌⚡⭐]\s*/, ''),
        faena: notesForm.faena,
        notas: notesForm.notas_presupuesto,
        isCustom: found.isCustom || false
      });
      setShowEditTplModal(true);
    }
  };

  const handleConfirmUpdateTemplate = (e) => {
    e.preventDefault();
    if (!editingTplData.name.trim()) return;

    if (editingTplData.isCustom) {
      const updated = customTemplates.map(t => {
        if (t.id === editingTplData.id) {
          return {
            ...t,
            name: `⭐ ${editingTplData.name.trim()}`,
            faena: editingTplData.faena,
            notas: editingTplData.notas
          };
        }
        return t;
      });
      setCustomTemplates(updated);
      localStorage.setItem('trimec_notas_plantillas', JSON.stringify(updated));
    } else {
      // Si edita una plantilla estándar, la guarda como una nueva versión personalizada
      const newTpl = {
        id: 'custom_' + Date.now(),
        name: `⭐ ${editingTplData.name.trim()} (Modificada)`,
        faena: editingTplData.faena,
        notas: editingTplData.notas,
        isCustom: true
      };
      const updated = [...customTemplates, newTpl];
      setCustomTemplates(updated);
      localStorage.setItem('trimec_notas_plantillas', JSON.stringify(updated));
      setSelectedTemplateId(newTpl.id);
    }

    setNotesForm({
      faena: editingTplData.faena,
      notas_presupuesto: editingTplData.notas
    });

    setShowEditTplModal(false);
    showToast('Plantilla actualizada con éxito', 'success');
  };

  const handleOpenDeleteModal = (templateId) => {
    setDeletingTplId(templateId);
    setShowDeleteTplModal(true);
  };

  const handleConfirmDeleteTemplate = () => {
    const updated = customTemplates.filter(t => t.id !== deletingTplId);
    setCustomTemplates(updated);
    localStorage.setItem('trimec_notas_plantillas', JSON.stringify(updated));
    if (selectedTemplateId === deletingTplId) {
      setSelectedTemplateId('');
    }
    setShowDeleteTplModal(false);
    showToast('Plantilla personalizada eliminada', 'info');
  };

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

  // Edit HH & Expense states
  const [editingHh, setEditingHh] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);

  // Inventario / Consumo States
  const [inventario, setInventario] = useState([]);
  const [showAddConsumoForm, setShowAddConsumoForm] = useState(false);
  const [newConsumo, setNewConsumo] = useState({ sku: '', cantidad: 1, fecha: new Date().toISOString().split('T')[0] });

  // Informe Técnico States
  const [informe, setInforme] = useState(null);
  const [isEditingInforme, setIsEditingInforme] = useState(false);
  const [informeForm, setInformeForm] = useState({ antes_condicion: '', despues_tareas: '', recomendaciones: '', fotos_antes: '[]', fotos_despues: '[]', hora_inicio_ejecucion: '', hora_fin_ejecucion: '', tecnico_id: '' });
  const [showInformePreview, setShowInformePreview] = useState(false);
  const [travelList, setTravelList] = useState([]);
  const [generatingDrive, setGeneratingDrive] = useState(false);

  const handleGenerateDriveFolder = async () => {
    setGeneratingDrive(true);
    try {
      const data = await api(`/ots/${otId}/crear-carpeta-drive`, {
        method: 'POST'
      });
      showToast(data.message || 'Carpeta de Drive creada con éxito', 'success');
      setOt(prev => ({ ...prev, drive_folder_url: data.drive_folder_url }));
    } catch (err) {
      showToast(err.message || 'Error al crear la carpeta en Google Drive', 'danger');
    } finally {
      setGeneratingDrive(false);
    }
  };

  const fetchOtDetail = async () => {
    setLoading(true);
    setError('');
    try {
      const [otData, hhData, expensesData, clientsData, filesData, workersData, inventarioData, informeData, travelsData] = await Promise.all([
        api(`/ots/${otId}`),
        api(`/hh/ot/${otId}`),
        api(`/gastos/ot/${otId}`),
        ['admin', 'supervisor', 'contador'].includes(userRole) ? api('/clientes') : Promise.resolve([]),
        api(`/ots/${otId}/archivos`),
        api('/trabajadores'),
        api('/inventario').catch(() => []),
        api(`/informes/ot/${otId}`).catch(() => null),
        api(`/traslados/ot/${otId}`).catch(() => [])
      ]);
      setOt(otData);
      setTravelList(travelsData);
      setHhList(hhData);
      setExpenses(expensesData);
      setClients(clientsData);
      setFiles(filesData);
      setWorkers(workersData);
      setEditForm({ ...otData, nuevo_id: otData.id, modificar_id: false });
      setNotesForm({
        faena: otData.faena || 'FAENA BUCALEMU.-',
        notas_presupuesto: otData.notas_presupuesto || DEFAULT_NOTAS
      });
      setInventario(inventarioData);
      setInforme(informeData);
      if (informeData) {
        setInformeForm({
          ...informeData,
          hora_inicio_ejecucion: informeData.hora_inicio_ejecucion || '',
          hora_fin_ejecucion: informeData.hora_fin_ejecucion || '',
          tecnico_id: informeData.tecnico_id || ''
        });
      } else {
        setInformeForm({ antes_condicion: '', despues_tareas: '', recomendaciones: '', fotos_antes: '[]', fotos_despues: '[]', hora_inicio_ejecucion: '', hora_fin_ejecucion: '', tecnico_id: '' });
      }
    } catch (err) {
      setError(err.message || 'Error al cargar los detalles de la OT');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async (e) => {
    e.preventDefault();
    try {
      await api(`/ots/${otId}`, {
        method: 'PUT',
        body: JSON.stringify(notesForm)
      });
      showToast('Notas del presupuesto actualizadas con éxito', 'success');
      setShowNotesModal(false);
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al guardar notas', 'danger');
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

  const handleUpdateHhSubmit = async (e) => {
    e.preventDefault();
    try {
      await api(`/hh/${editingHh.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ot_id: otId,
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
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al actualizar horas', 'danger');
    }
  };

  const handleDeleteHh = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este registro de horas?')) return;
    try {
      await api(`/hh/${id}`, { method: 'DELETE' });
      showToast('Registro de horas eliminado', 'success');
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al eliminar registro de horas', 'danger');
    }
  };

  const handleUpdateExpenseSubmit = async (e) => {
    e.preventDefault();
    const net = parseFloat(editingExpense.valor_neto) || 0;
    const iva = net * 0.19;
    const total = net + iva;
    try {
      await api(`/gastos/${editingExpense.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ot_id: otId,
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
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al actualizar gasto', 'danger');
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('¿Seguro que deseas eliminar este gasto?')) return;
    try {
      await api(`/gastos/${id}`, { method: 'DELETE' });
      showToast('Gasto eliminado', 'success');
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al eliminar gasto', 'danger');
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

  const handleDownloadInformePdf = () => {
    const token = localStorage.getItem('trimec_token');
    window.open(`${BASE_URL}/ots/${otId}/informe-pdf?token=${token || ''}`, '_blank');
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

  // 5 Etapas Oficiales de Avance
  const STAGES_LIST = [
    { id: 'SP', name: '1. SP', color: '#f59e0b', statuses: ['SP'] },
    { id: 'En Proceso', name: '2. En Ejecución / OT', color: '#8b5cf6', statuses: ['Presupuestada', 'Aprobada', 'En Proceso'] },
    { id: 'Liquidada', name: '3. Liquidar', color: '#06b6d4', statuses: ['Terminada', 'Liquidada'] },
    { id: 'Facturada', name: '4. Facturar', color: '#10b981', statuses: ['Facturada'] },
    { id: 'Cerrada', name: '5. Cerradas', color: '#64748b', statuses: ['Cerrada'] }
  ];

  const currentStageIndex = STAGES_LIST.findIndex(s => s.statuses.includes(ot.estado));

  const getOtSemaforoDetail = (ot) => {
    if (!ot) return { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '⚪ N/A' };
    const isSp = ot.estado === 'SP';
    const today = new Date();
    today.setHours(0,0,0,0);

    if (isSp) {
      if (ot.fecha_envio_presupuesto) {
        return {
          color: '#a855f7',
          bgColor: 'rgba(168, 85, 247, 0.18)',
          border: '#a855f7',
          text: `🟣 Presupuesto Enviado (${ot.fecha_envio_presupuesto})`
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
        return { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '⚪ Sin Fecha Límite Presupuesto' };
      }

      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: `🔴 Presupuesto Vencido (${Math.abs(diffDays)}d retraso)` };
      }
      if (diffDays <= 1) {
        return { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: `🟡 Presupuesto Vence ${diffDays === 0 ? 'Hoy' : 'Mañana'}` };
      }
      return { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: `🟢 Presupuesto en Plazo (${diffDays}d restantes)` };
    } else {
      if (!ot.fecha_entrega) {
        return { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '⚪ Sin Fecha Entrega Trabajos' };
      }

      const deadline = new Date(ot.fecha_entrega + 'T00:00:00');
      if (isNaN(deadline.getTime())) {
        return { color: '#64748b', bgColor: 'rgba(100, 116, 139, 0.15)', border: '#64748b', text: '⚪ Fecha Entrega Inválida' };
      }

      const diffTime = deadline.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        return { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.18)', border: '#ef4444', text: `🔴 Entrega Atrasada (${Math.abs(diffDays)}d retraso)` };
      }
      if (diffDays <= 1) {
        return { color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.18)', border: '#f59e0b', text: `🟡 Entrega Trabajo ${diffDays === 0 ? 'Hoy' : 'Mañana'}` };
      }
      return { color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.18)', border: '#10b981', text: `🟢 Trabajo en Plazo (${diffDays}d restantes)` };
    }
  };

  const handleMarcarEnviado = async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      await api(`/ots/${otId}`, {
        method: 'PUT',
        body: JSON.stringify({ fecha_envio_presupuesto: todayStr })
      });
      showToast('Presupuesto marcado como Enviado al Cliente (Estado Morado 🟣)', 'success');
      fetchOtDetail();
    } catch (err) {
      showToast(err.message || 'Error al marcar presupuesto enviado', 'danger');
    }
  };

  const semDetail = getOtSemaforoDetail(ot);

  return (
    <div className="dashboard-container">
      <div className="dashboard-title-bar" style={{ marginBottom: '1.5rem' }}>
        <div>
          <button className="btn btn-secondary btn-sm" onClick={onBack} style={{ marginBottom: '1rem' }}>
            ← Volver al Listado
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h2 style={{ display: 'inline', margin: 0 }}>OT {ot.id} - {ot.cliente_nombre}</h2>
            {ot.es_emergencia === 1 && <span className="badge badge-sp">EMERGENCIA</span>}
            <span className="badge" style={{ background: semDetail.bgColor, color: semDetail.color, border: `1px solid ${semDetail.border}`, fontWeight: 700, fontSize: '0.85rem' }}>
              {semDetail.text}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {ot.estado === 'SP' && !ot.fecha_envio_presupuesto && ['admin', 'supervisor'].includes(userRole) && (
            <button className="btn btn-secondary" style={{ background: '#a855f7', color: '#fff', border: 'none' }} onClick={handleMarcarEnviado}>
              🟣 Marcar Presupuesto Enviado
            </button>
          )}
          {['admin', 'supervisor'].includes(userRole) && (
            <button className="btn btn-secondary" onClick={() => setShowNotesModal(true)}>
              📝 Configurar Notas / Faena
            </button>
          )}
          {userRole === 'admin' && (
            <button className="btn btn-secondary" onClick={() => setIsEditing(!isEditing)}>
              {isEditing ? 'Cancelar Edición' : '⚙️ Editar OT'}
            </button>
          )}
          {['admin', 'supervisor'].includes(userRole) && (
            <button className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }} onClick={handleDownloadInformePdf}>
              📄 Descargar Informe Técnico PDF
            </button>
          )}
          <button className="btn btn-primary" onClick={handleDownloadPdf}>
            📄 Descargar Presupuesto PDF
          </button>
        </div>
      </div>

      {/* Visual Pipeline Status (5 Etapas de Avance) */}
      <div className="panel-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
        <h4 style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: 600 }}>
          Estado de Avance de la Orden de Trabajo (Etapa: <strong style={{ color: STAGES_LIST[currentStageIndex >= 0 ? currentStageIndex : 0].color }}>{STAGES_LIST[currentStageIndex >= 0 ? currentStageIndex : 0].name}</strong>)
        </h4>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', overflowX: 'auto', padding: '0.5rem 0' }}>
          {STAGES_LIST.map((stage, i) => {
            const isActive = currentStageIndex >= i;
            const isCurrent = currentStageIndex === i;
            return (
              <div 
                key={stage.id} 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  zIndex: 2, 
                  flex: 1, 
                  minWidth: '100px', 
                  cursor: ['admin', 'supervisor'].includes(userRole) ? 'pointer' : 'default' 
                }} 
                onClick={() => {
                  if (['admin', 'supervisor'].includes(userRole)) {
                    handleStatusChange(stage.id);
                  } else {
                    showToast('No tienes permisos para cambiar el estado de la OT', 'danger');
                  }
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: isCurrent ? stage.color : isActive ? stage.color : 'rgba(255,255,255,0.05)',
                  border: '3px solid',
                  borderColor: isCurrent ? '#ffffff' : isActive ? 'transparent' : 'var(--panel-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  color: isActive || isCurrent ? '#ffffff' : 'var(--text-muted)',
                  boxShadow: isCurrent ? `0 0 12px ${stage.color}` : 'none'
                }}>
                  {i + 1}
                </div>
                <span style={{ 
                  fontSize: '0.8rem', 
                  marginTop: '0.5rem', 
                  fontWeight: isCurrent ? '800' : '600', 
                  color: isCurrent ? stage.color : isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  {stage.name}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.1rem' }}>
                  ({ot.estado && stage.statuses.includes(ot.estado) ? ot.estado : stage.statuses[0]})
                </span>
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
                <label>Fecha Límite Presupuesto (3 días SP)</label>
                <input type="date" className="form-control" value={editForm.fecha_proyectada_presupuesto || ''} onChange={(e) => setEditForm({ ...editForm, fecha_proyectada_presupuesto: e.target.value })} />
              </div>
              <div className="form-group flex-grow">
                <label>Fecha Envió Presupuesto (Morado 🟣)</label>
                <input type="date" className="form-control" value={editForm.fecha_envio_presupuesto || ''} onChange={(e) => setEditForm({ ...editForm, fecha_envio_presupuesto: e.target.value })} />
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

              {/* Google Drive Integration Info/Link */}
              <div style={{ marginBottom: '1.25rem', background: 'rgba(66, 133, 244, 0.08)', border: '1px solid rgba(66, 133, 244, 0.3)', padding: '0.75rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                  <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{ot.drive_folder_url ? '📂' : '📁'}</span>
                  <div style={{ overflow: 'hidden' }}>
                    <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#4285f4', fontWeight: 600 }}>
                      {ot.drive_folder_url ? 'Carpeta de la OT en Google Drive' : 'Carpeta Raíz en Google Drive'}
                    </h4>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {ot.drive_folder_url 
                        ? `Asignada: OT ${ot.id} - ${ot.cliente_nombre}` 
                        : 'Respaldo de OTs, fotos de terreno de operarios y órdenes de compra.'}
                    </p>
                  </div>
                </div>
                {ot.drive_folder_url ? (
                  <a 
                    href={ot.drive_folder_url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="btn btn-primary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', backgroundColor: '#4285f4', borderColor: '#4285f4' }}
                  >
                    Abrir Carpeta ➡️
                  </a>
                ) : (
                  <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                    <a 
                      href="https://drive.google.com/drive/folders/1-WvEKcnWOovvsfmRCNGGJ92b8TEEXJoz?usp=sharing"
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                      title="Abrir carpeta raíz general"
                    >
                      Raíz 📁
                    </a>
                    <button 
                      onClick={handleGenerateDriveFolder}
                      disabled={generatingDrive}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', backgroundColor: '#4285f4', borderColor: '#4285f4', fontSize: '0.75rem', padding: '0.35rem 0.5rem' }}
                    >
                      {generatingDrive ? 'Creando...' : '➕ Crear Carpeta'}
                    </button>
                  </div>
                )}
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
                  <div className="row mb-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label>Hora Inicio Ejecución</label>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={informeForm.hora_inicio_ejecucion} 
                        onChange={(e) => setInformeForm({ ...informeForm, hora_inicio_ejecucion: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Hora Fin Ejecución</label>
                      <input 
                        type="time" 
                        className="form-control" 
                        value={informeForm.hora_fin_ejecucion} 
                        onChange={(e) => setInformeForm({ ...informeForm, hora_fin_ejecucion: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Técnico Ejecutor</label>
                      <select 
                        className="form-select" 
                        value={informeForm.tecnico_id} 
                        onChange={(e) => setInformeForm({ ...informeForm, tecnico_id: e.target.value })}
                      >
                        <option value="">-- Seleccionar Técnico --</option>
                        {workers.map(w => (
                          <option key={w.id} value={w.id}>{w.nombre} ({w.rol})</option>
                        ))}
                      </select>
                    </div>
                  </div>
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
                  {(informe.hora_inicio_ejecucion || informe.hora_fin_ejecucion || informe.tecnico_id) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem' }}>
                      {informe.tecnico_id && (
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Técnico Ejecutor:</strong>
                          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem' }}>
                            {workers.find(w => w.id === parseInt(informe.tecnico_id))?.nombre || `Técnico #${informe.tecnico_id}`}
                          </p>
                        </div>
                      )}
                      {informe.hora_inicio_ejecucion && (
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Inicio Ejecución:</strong>
                          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem' }}>{informe.hora_inicio_ejecucion} hrs</p>
                        </div>
                      )}
                      {informe.hora_fin_ejecucion && (
                        <div>
                          <strong style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Término Ejecución:</strong>
                          <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem' }}>{informe.hora_fin_ejecucion} hrs</p>
                        </div>
                      )}
                    </div>
                  )}
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

            {/* Bitácora de Traslados y Viajes */}
            {['admin', 'supervisor'].includes(userRole) && (
              <div className="panel-card" style={{ marginTop: '1.5rem' }}>
                <div className="panel-header" style={{ marginBottom: '1rem' }}>
                  <h3>Bitácora de Traslados y Viajes</h3>
                  <span className="text-muted" style={{ fontSize: '0.8rem' }}>Sincronizado de terreno (AppSheet / Operador)</span>
                </div>
                
                {travelList.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--panel-border)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.8rem' }}>Fecha</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.8rem' }}>Conductor</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.8rem' }}>Vehículo</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>Kilómetros</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>Salida / Llegada (Taller - Faena)</th>
                          <th style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem' }}>Retorno (Faena - Taller)</th>
                          <th style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.8rem' }}>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {travelList.map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px solid var(--panel-border)', fontSize: '0.85rem' }}>
                            <td style={{ padding: '0.5rem' }}>{t.fecha}</td>
                            <td style={{ padding: '0.5rem' }}>{t.trabajador_nombre}</td>
                            <td style={{ padding: '0.5rem' }}><strong>{t.patente_vehiculo}</strong></td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {t.km_inicio} - {t.km_termino || '?'} km ({t.km_termino ? (t.km_termino - t.km_inicio).toFixed(1) : '?'} km)
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {t.hora_salida_taller || '--'} ➡️ {t.hora_llegada_faena || '--'}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              {t.hora_salida_faena || '--'} ➡️ {t.hora_llegada_taller || '--'}
                            </td>
                            <td style={{ padding: '0.5rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{t.detalle_viaje || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', border: '1px dashed var(--panel-border)', borderRadius: '0.75rem' }}>
                    No se han registrado viajes de traslado para esta OT.
                  </div>
                )}
              </div>
            )}
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
                      {['admin', 'supervisor'].includes(userRole) && <th>Acción</th>}
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
                        {['admin', 'supervisor'].includes(userRole) && (
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => setEditingHh({ ...hh })}>✏️</button>
                              <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDeleteHh(hh.id)}>🗑️</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {hhList.length === 0 && (
                      <tr>
                        <td colSpan={['admin', 'supervisor'].includes(userRole) ? "5" : "4"} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Sin horas imputadas en esta OT.</td>
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
                        <option value="MATERIALES">Item N°2 - Repuestos / Materiales</option>
                        <option value="INSUMOS">Item N°3 - Insumos y EPP</option>
                        <option value="TERCEROS">Item N°4 - Servicios de Terceros</option>
                        <option value="Combustible">Combustible y Transportes</option>
                        <option value="Peaje">Peajes y Pasajes</option>
                        <option value="Almuerzo">Almuerzo / Alimentación</option>
                        <option value="Otros">Otros Gastos</option>
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
                      {['admin', 'supervisor'].includes(userRole) && <th>Acción</th>}
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
                        {['admin', 'supervisor'].includes(userRole) && (
                          <td>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => setEditingExpense({ ...exp })}>✏️</button>
                              <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.4rem' }} onClick={() => handleDeleteExpense(exp.id)}>🗑️</button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr>
                        <td colSpan={['admin', 'supervisor'].includes(userRole) ? "5" : "4"} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)' }}>Sin compras registradas para esta OT.</td>
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

      {/* MODAL: EDITAR REGISTRO HH */}
      {editingHh && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Editar Registro de Horas (HH)</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setEditingHh(null)}>Cerrar</button>
            </div>
            <form onSubmit={handleUpdateHhSubmit}>
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
            <form onSubmit={handleUpdateExpenseSubmit}>
              <div className="flex-row-gap">
                <div className="form-group flex-grow">
                  <label>Categoría Gasto</label>
                  <select className="form-control" value={editingExpense.clasificacion} onChange={(e) => setEditingExpense({ ...editingExpense, clasificacion: e.target.value })}>
                    <option value="MATERIALES">Item N°2 - Repuestos / Materiales</option>
                    <option value="INSUMOS">Item N°3 - Insumos y EPP</option>
                    <option value="TERCEROS">Item N°4 - Servicios de Terceros</option>
                    <option value="Combustible">Combustible y Transportes</option>
                    <option value="Peaje">Peajes y Pasajes</option>
                    <option value="Almuerzo">Almuerzo / Alimentación</option>
                    <option value="Otros">Otros Gastos</option>
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

              {editingExpense.valor_neto && (
                <div style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>IVA (19%): ${Math.round(parseFloat(editingExpense.valor_neto) * 0.19).toLocaleString('es-CL')}</span>
                    <strong>Total Estimado: ${Math.round(parseFloat(editingExpense.valor_neto) * 1.19).toLocaleString('es-CL')}</strong>
                  </div>
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Guardar Cambios</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURAR NOTAS Y FAENA DEL PRESUPUESTO PDF */}
      {showNotesModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div className="modal-header">
              <h3>Configurar Notas y Faena (Presupuesto PDF)</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowNotesModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleSaveNotes}>
              
              {/* PLANTILLAS PREDISENADAS Y PERSONALIZADAS */}
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--panel-border)', padding: '0.85rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.35rem', display: 'block' }}>
                  📋 Cargar Plantilla de Faena / Notas Tipo
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select 
                    className="form-control" 
                    style={{ fontSize: '0.85rem' }} 
                    value={selectedTemplateId} 
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                  >
                    <option value="">-- Seleccionar Plantilla Prediseñada --</option>
                    <optgroup label="Plantillas Estándar de la Empresa">
                      {DEFAULT_PLANTILLAS.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </optgroup>
                    {customTemplates.length > 0 && (
                      <optgroup label="Mis Plantillas Personalizadas">
                        {customTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }} 
                    onClick={handleOpenSaveModal}
                    title="Guardar los datos actuales como una nueva plantilla reutilizable"
                  >
                    💾 Nueva Plantilla
                  </button>

                  {selectedTemplateId && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ whiteSpace: 'nowrap', fontSize: '0.75rem' }} 
                      onClick={handleOpenEditModal}
                      title="Editar o actualizar el nombre/notas de la plantilla seleccionada"
                    >
                      ✏️ Editar
                    </button>
                  )}

                  {customTemplates.some(t => t.id === selectedTemplateId) && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ color: '#ef4444', borderColor: '#ef4444', fontSize: '0.75rem' }} 
                      onClick={() => handleOpenDeleteModal(selectedTemplateId)}
                      title="Eliminar esta plantilla personalizada"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              <div className="form-group mb-3">
                <label style={{ fontWeight: 600 }}>Faena / Ubicación Destacada (Encabezado PDF)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: FAENA BUCALEMU.-" 
                  value={notesForm.faena} 
                  onChange={(e) => setNotesForm({ ...notesForm, faena: e.target.value })} 
                />
              </div>

              <div className="form-group mb-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ margin: 0, fontWeight: 600 }}>Notas y Condiciones Comerciales (Pie del PDF)</label>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }} 
                    onClick={() => {
                      setNotesForm({ ...notesForm, notas_presupuesto: DEFAULT_NOTAS });
                      setSelectedTemplateId('bucalemu_std');
                    }}
                  >
                    Restablecer Estándar
                  </button>
                </div>
                <textarea 
                  className="form-control" 
                  rows="9" 
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  value={notesForm.notas_presupuesto} 
                  onChange={(e) => setNotesForm({ ...notesForm, notas_presupuesto: e.target.value })} 
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowNotesModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Guardar y Actualizar PDF
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 1: GUARDAR NUEVA PLANTILLA */}
      {showSaveTplModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>💾 Guardar Nueva Plantilla de Notas</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSaveTplModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleConfirmSaveNewTemplate}>
              <div className="form-group mb-3">
                <label style={{ fontWeight: 600 }}>Nombre Descriptivo de la Plantilla</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Ej: Faena Minera / Turno Nocturno" 
                  value={newTplName} 
                  onChange={(e) => setNewTplName(e.target.value)} 
                  required 
                  autoFocus 
                />
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <strong>Vista Previa de Datos a Guardar:</strong>
                <div>• Faena: {notesForm.faena || '(Sin definir)'}</div>
                <div>• Total de Cláusulas / Líneas: {notesForm.notas_presupuesto ? notesForm.notas_presupuesto.split('\n').length : 0}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSaveTplModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">💾 Guardar Plantilla</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 2: EDITAR / ACTUALIZAR PLANTILLA */}
      {showEditTplModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>✏️ Editar / Actualizar Plantilla de Notas</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowEditTplModal(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleConfirmUpdateTemplate}>
              <div className="form-group mb-3">
                <label style={{ fontWeight: 600 }}>Nombre de la Plantilla</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editingTplData.name} 
                  onChange={(e) => setEditingTplData({ ...editingTplData, name: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group mb-3">
                <label style={{ fontWeight: 600 }}>Faena Destacada</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={editingTplData.faena} 
                  onChange={(e) => setEditingTplData({ ...editingTplData, faena: e.target.value })} 
                />
              </div>
              <div className="form-group mb-3">
                <label style={{ fontWeight: 600 }}>Contenido de Notas y Cláusulas</label>
                <textarea 
                  className="form-control" 
                  rows="7" 
                  style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                  value={editingTplData.notas} 
                  onChange={(e) => setEditingTplData({ ...editingTplData, notas: e.target.value })} 
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditTplModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Actualizar y Aplicar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL 3: CONFIRMAR ELIMINACION DE PLANTILLA */}
      {showDeleteTplModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ color: '#ef4444' }}>🗑️ Eliminar Plantilla</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowDeleteTplModal(false)}>Cerrar</button>
            </div>
            <div style={{ padding: '0.5rem 0 1.25rem 0', fontSize: '0.9rem' }}>
              ¿Estás seguro de que deseas eliminar esta plantilla personalizada de forma definitiva?
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteTplModal(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444' }} onClick={handleConfirmDeleteTemplate}>
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OtDetail;

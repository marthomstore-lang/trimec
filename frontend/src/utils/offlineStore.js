// Helper para manejo de IndexedDB y Cola de Sincronización Offline

const DB_NAME = 'TrimecOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

/**
 * Guarda una solicitud fallida o creada en modo offline en la cola de IndexedDB
 * @param {Object} item - { type: 'TRASLADO'|'GASTO'|'HH'|'FOTO', endpoint: string, method: string, payload: Object, label: string }
 */
export async function saveOfflineItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const data = {
      ...item,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };
    const req = store.add(data);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Obtiene todos los elementos pendientes en la cola offline
 */
export async function getOfflineQueue() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Elimina un elemento procesado de la cola
 */
export async function removeOfflineItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Procesa y sincroniza todos los elementos en cola al recuperar la conexión
 */
export async function syncOfflineQueue(apiFetch, onProgress) {
  if (!navigator.onLine) return { success: false, syncedCount: 0, error: 'Sin conexión' };

  const queue = await getOfflineQueue();
  if (queue.length === 0) return { success: true, syncedCount: 0 };

  let syncedCount = 0;
  const errors = [];

  for (const item of queue) {
    try {
      if (onProgress) onProgress(`Sincronizando: ${item.label || item.type}...`);
      await apiFetch(item.endpoint, {
        method: item.method || 'POST',
        body: JSON.stringify(item.payload)
      });
      await removeOfflineItem(item.id);
      syncedCount++;
    } catch (err) {
      console.error(`Error al sincronizar item ${item.id}:`, err);
      errors.push({ id: item.id, error: err.message });
    }
  }

  return {
    success: errors.length === 0,
    syncedCount,
    remainingCount: queue.length - syncedCount,
    errors
  };
}

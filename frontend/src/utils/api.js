const BASE_URL = '/api';

const api = async (endpoint, options = {}) => {
  const token = localStorage.getItem('trimec_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = 'Ha ocurrido un error en la solicitud';
    try {
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        errMsg = data.message || data.error || errMsg;
      } catch (jsonErr) {
        if (text && text.trim().length < 250) {
          errMsg = text.trim();
        }
      }
    } catch (e) {
      // Ignorar si no se puede leer respuesta
    }
    throw new Error(errMsg);
  }

  // Si no hay contenido (ej: DELETE), no intentar parsear JSON
  if (response.status === 204) {
    return null;
  }

  // Si es un archivo (ej: descarga de PDF), retornar la respuesta completa
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/pdf')) {
    return response.blob();
  }

  return response.json();
};

export const downloadPdf = async (endpoint, filename = 'documento.pdf') => {
  const blob = await api(endpoint);
  if (!(blob instanceof Blob)) {
    throw new Error('La respuesta del servidor no es un archivo PDF válido');
  }
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 2000);
};

export default api;
export { BASE_URL };

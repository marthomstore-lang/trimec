const isProd = import.meta.env.PROD;
const BASE_URL = isProd 
  ? '/api' 
  : `http://${window.location.hostname}:5000/api`;

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
      const data = await response.json();
      errMsg = data.message || errMsg;
    } catch (e) {
      // Ignorar si no es JSON
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

export default api;
export { BASE_URL };

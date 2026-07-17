import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true, // envía la cookie httpOnly del JWT automáticamente
});

// Ya NO se lee/escribe ningún token en JavaScript: el JWT vive en una cookie
// httpOnly que el navegador adjunta solo. Un XSS no puede leerla ni robarla.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 (no autenticado / cookie revocada) o 403 (rol insuficiente) => a login.
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/** Logout: revoca el token en el servidor y borra la cookie httpOnly. */
export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    /* aunque falle, redirigimos igual */
  } finally {
    window.location.href = '/login';
  }
}

export default api;

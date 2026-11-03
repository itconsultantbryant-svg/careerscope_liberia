import axios from 'axios';
import { setupOfflineSupport } from './offline.js';

export const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');

export const assetUrl = (path) => {
  if (!path || path.startsWith('http') || path.startsWith('data:')) return path;
  return `${API_ORIGIN}${path}`;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Setup offline support
setupOfflineSupport(api);

export default api;

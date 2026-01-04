import axios from 'axios';
import { setupOfflineSupport } from './offline.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Setup offline support
setupOfflineSupport(api);

export default api;


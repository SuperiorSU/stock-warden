import axios from 'axios';
import { toast } from 'react-hot-toast';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Interceptor to handle 401 and offline
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // Network offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('You are offline. Your action will retry when reconnected.', { duration: Infinity });
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

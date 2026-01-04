// Simple offline support - cache API responses in localStorage
export const cacheKey = (endpoint) => `careerscope_cache_${endpoint}`;

export const getCachedData = (endpoint) => {
  try {
    const cached = localStorage.getItem(cacheKey(endpoint));
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Cache valid for 1 hour
      if (Date.now() - timestamp < 60 * 60 * 1000) {
        return data;
      }
    }
  } catch (error) {
    console.error('Error reading cache:', error);
  }
  return null;
};

export const setCachedData = (endpoint, data) => {
  try {
    localStorage.setItem(
      cacheKey(endpoint),
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch (error) {
    console.error('Error setting cache:', error);
  }
};

export const isOnline = () => navigator.onLine;

// Intercept axios requests to use cache when offline
export const setupOfflineSupport = (axiosInstance) => {
  // Request interceptor - use cache if offline
  axiosInstance.interceptors.request.use(
    (config) => {
      if (!isOnline()) {
        const cached = getCachedData(config.url);
        if (cached) {
          // Return cached response
          return Promise.reject({
            isCached: true,
            data: cached,
            config,
          });
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor - cache successful responses
  axiosInstance.interceptors.response.use(
    (response) => {
      if (isOnline() && response.config.method === 'get') {
        setCachedData(response.config.url, response.data);
      }
      return response;
    },
    (error) => {
      // Handle cached responses
      if (error.isCached) {
        return Promise.resolve({
          data: error.data,
          status: 200,
          statusText: 'OK (Cached)',
          headers: {},
          config: error.config,
        });
      }
      return Promise.reject(error);
    }
  );
};


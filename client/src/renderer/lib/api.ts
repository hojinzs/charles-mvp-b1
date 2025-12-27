import axios, { AxiosInstance } from 'axios';

let api: AxiosInstance | null = null;
let currentBaseUrl: string | null = null;

export const initApi = (baseUrl: string) => {
  if (currentBaseUrl === baseUrl && api) return;

  currentBaseUrl = baseUrl;
  api = axios.create({
    baseURL: baseUrl,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

const getApi = () => {
  if (!api) {
    throw new Error('API not initialized. Call initApi first.');
  }
  return api;
};

// Response wrapper to handle standard response format { success: true, data: ... } or direct data
const handleResponse = async (request: Promise<any>) => {
  try {
    const response = await request;
    const data = response.data;
    // If the backend wraps response in { success: true, data: ... }, unwrap it.
    // Based on previous main/index.ts logic:
    if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
      return data.data;
    }
    return data;
  } catch (error: any) {
    console.error('API Error:', error);
    // Propagate error with message
    if (error.response && error.response.data && error.response.data.message) {
      throw new Error(error.response.data.message);
    }
    throw error;
  }
};

export const apiClient = {
  checkConnection: async (url: string) => {
     // For check connection, we might use a temporary instance or the main one if initialized
     try {
       const cleanUrl = url.replace(/\/$/, '');
       const response = await axios.get(`${cleanUrl}/health`);
       return { success: response.status === 200, message: response.statusText };
     } catch (e: any) {
       return { success: false, message: e.message };
     }
  },

  // Keywords
  getKeywords: () => handleResponse(getApi().get('/api/keywords')),
  addKeyword: (keyword: string, url: string) => handleResponse(getApi().post('/api/keywords', { keyword, url })),
  addKeywordsBulk: (items: {keyword: string, url: string}[]) => {
      // The previous implementation did Promise.all on the client (main process).
      // Ideally the backend should support bulk insert. 
      // If backend doesn't support bulk, we simulate it here to match previous behavior.
      // Looking at main/index.ts, it was doing Promise.all([backendRequest...])
      // So we will do the same here for now.
      return Promise.all(items.map(item => handleResponse(getApi().post('/api/keywords', item))));
  },
  deleteKeywords: (ids: number[]) => {
      // Similarly, main/index.ts did Promise.all for deletes.
      return Promise.all(ids.map(id => handleResponse(getApi().delete(`/api/keywords/${id}`))));
  },

  // Rankings & History
  getRankings: (keywordId: number) => handleResponse(getApi().get(`/api/rankings`, { params: { keywordId } })), 
  getAllHistory: () => handleResponse(getApi().get('/api/rankings')), // Check if this matches main/index.ts logic for 'keyword:history_all' -> '/api/rankings'

  // Jobs / Scheduler
  getSchedulerQueue: () => handleResponse(getApi().get('/api/jobs/queue')),
};

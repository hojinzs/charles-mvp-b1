import axios, { AxiosInstance } from 'axios';
import { chunk } from 'lodash';


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
  getKeywords: (params?: { page?: number; limit?: number; sortBy?: string; order?: 'asc' | 'desc'; search?: string; tag?: string }) => 
    handleResponse(getApi().get('/api/keywords', { params })),
  addKeyword: (keyword: string, url: string, tags?: string[], targetRank?: number) => handleResponse(getApi().post('/api/keywords', { keyword, url, tags, targetRank })),
  updateKeyword: (id: number, data: { keyword: string; url: string; tags?: string[]; targetRank?: number }) => handleResponse(getApi().put(`/api/keywords/${id}`, data)),
  addKeywordsBulk: async (items: {keyword: string; url: string; tags?: string[]; targetRank?: number}[]) => {
      // Chunk items into batches of 100 to avoid overwhelming the server
      const batches = chunk(items, 100);
      const allResults: any[] = [];
      
      for (const batch of batches) {
         // Process each batch
         const batchResults = await Promise.allSettled(
           batch.map(item => handleResponse(getApi().post('/api/keywords', item)).then(res => ({ ...res, _item: item })))
         );
         
         // Map results to include original item for error tracking
         const mappedResults = batchResults.map((result, index) => {
            if (result.status === 'fulfilled') {
              return { status: 'fulfilled', value: result.value, item: batch[index] };
            } else {
              // Extract error message
              const reason = result.reason?.message || result.reason || "Unknown error";
              return { status: 'rejected', reason, item: batch[index] };
            }
         });
         
         allResults.push(...mappedResults);
      }

      // Calculate stats
      const total = allResults.length;
      const success = allResults.filter(r => r.status === 'fulfilled').length;
      const failed = total - success;

      return {
        results: allResults,
        stats: { total, success, failed }
      };
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
  enqueuePriority: (ids: number[]) => handleResponse(getApi().post('/api/jobs/enqueue/priority', { ids })),
  deleteJob: (jobId: string) => handleResponse(getApi().delete(`/api/jobs/${jobId}`)),
  cleanQueue: () => handleResponse(getApi().post('/api/jobs/clean')),
};

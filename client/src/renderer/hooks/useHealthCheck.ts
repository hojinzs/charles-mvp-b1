import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api';

export type HealthStatus = 'green' | 'orange' | 'red';

export interface HealthInfo {
  status: HealthStatus;
  latency: number | null;
  error: string | null;
}

export function useHealthCheck(backendUrl: string | null, intervalMs: number = 5000) {
  const [health, setHealth] = useState<HealthInfo>({
    status: 'red',
    latency: null,
    error: 'Not connected',
  });

  useEffect(() => {
    if (!backendUrl) {
      setHealth({ status: 'red', latency: null, error: 'No backend URL' });
      return;
    }

    const checkHealth = async () => {
      const start = Date.now();
      try {
        const res = await apiClient.checkConnection(backendUrl);
        const end = Date.now();
        const latency = end - start;

        if (res.success) {
          let status: HealthStatus = 'green';
          if (latency > 1000) {
            status = 'red';
          } else if (latency > 200) {
            status = 'orange';
          }

          setHealth({ status, latency, error: null });
        } else {
          setHealth({ status: 'red', latency: null, error: res.message || 'Connection failed' });
        }
      } catch (e: any) {
        setHealth({ status: 'red', latency: null, error: e.message || 'Unknown error' });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, intervalMs);

    return () => clearInterval(interval);
  }, [backendUrl, intervalMs]);

  return health;
}

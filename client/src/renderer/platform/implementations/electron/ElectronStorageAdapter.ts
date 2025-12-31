import { IStorageAdapter } from '../../adapters/StorageAdapter';

/**
 * Electron Storage Adapter
 * Uses Electron IPC for backend_url and localStorage for other data
 */
export class ElectronStorageAdapter implements IStorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    // Backend URL is stored via Electron IPC (electron-store)
    if (key === 'backend_url') {
      try {
        const url = await window.electronAPI.getBackendUrl();
        return (url || null) as T;
      } catch (error) {
        console.error('Failed to get backend URL from Electron:', error);
        return null;
      }
    }

    // Other settings fall back to localStorage
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    // Backend URL is stored via Electron IPC (electron-store)
    if (key === 'backend_url') {
      try {
        await window.electronAPI.setBackendUrl(value as string);
      } catch (error) {
        console.error('Failed to set backend URL in Electron:', error);
        throw error;
      }
      return;
    }

    // Other settings fall back to localStorage
    localStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    // Backend URL is stored via Electron IPC
    if (key === 'backend_url') {
      try {
        await window.electronAPI.disconnect();
      } catch (error) {
        console.error('Failed to disconnect in Electron:', error);
        throw error;
      }
      return;
    }

    // Other settings fall back to localStorage
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    try {
      await window.electronAPI.disconnect();
    } catch (error) {
      console.error('Failed to disconnect in Electron:', error);
    }
    localStorage.clear();
  }
}

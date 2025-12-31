import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { detectRuntime } from '../platform/runtime';

interface SettingsState {
  backendUrl: string | null;
  setBackendUrl: (url: string | null) => void;
  clearBackendUrl: () => void;
}

/**
 * Platform-agnostic storage for Zustand
 * Uses Electron IPC in Electron, localStorage in Web
 */
import { IStorageAdapter } from '../platform/adapters/StorageAdapter';
import { ElectronStorageAdapter } from '../platform/implementations/electron/ElectronStorageAdapter';
import { WebStorageAdapter } from '../platform/implementations/web/WebStorageAdapter';

/**
 * Platform-agnostic storage for Zustand
 * Uses Electron IPC in Electron, localStorage in Web via adapters
 */
function createPlatformStorage(): StateStorage {
  const runtime = detectRuntime();
  const adapter: IStorageAdapter = runtime === 'electron' 
    ? new ElectronStorageAdapter() 
    : new WebStorageAdapter();

  return {
    getItem: async (name: string): Promise<string | null> => {
      // We map the entire settings store to 'backend_url' key for now
      // as that's the only setting we persist via IPC in Electron
      try {
        const url = await adapter.get<string>('backend_url');
        if (!url) return null;
        return JSON.stringify({
          state: { backendUrl: url },
          version: 0,
        });
      } catch (e) {
        console.error('Failed to get backend URL from storage adapter', e);
        return null;
      }
    },
    setItem: async (name: string, value: string): Promise<void> => {
      try {
        const parsed = JSON.parse(value);
        const url = parsed.state?.backendUrl;
        console.log('[Zustand] Persisting backendUrl:', url);
        
        if (url) {
          await adapter.set('backend_url', url);
        } else {
          await adapter.remove('backend_url');
        }
      } catch (e) {
        console.error('Failed to set backend URL to storage adapter', e);
      }
    },
    removeItem: async (name: string): Promise<void> => {
      try {
        await adapter.remove('backend_url');
      } catch (e) {
        console.error('Failed to remove backend URL from storage adapter', e);
      }
    },
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backendUrl: null,
      setBackendUrl: (url) => set({ backendUrl: url }),
      clearBackendUrl: () => set({ backendUrl: null }),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(createPlatformStorage),
      onRehydrateStorage: () => (state) => {
        console.log('Hydration finished', state);
      },
    }
  )
);

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
function createPlatformStorage(): StateStorage {
  const runtime = detectRuntime();

  if (runtime === 'electron') {
    // Electron: Use window.electronAPI
    return {
      getItem: async (name: string): Promise<string | null> => {
        try {
          const url = await window.electronAPI.getBackendUrl();
          if (!url) return null;
          return JSON.stringify({
            state: { backendUrl: url },
            version: 0,
          });
        } catch (e) {
          console.error('Failed to get backend URL from electron store', e);
          return null;
        }
      },
      setItem: async (name: string, value: string): Promise<void> => {
        try {
          const parsed = JSON.parse(value);
          const url = parsed.state.backendUrl;
          console.log('[Zustand] Persisting backendUrl:', url);
          if (url) {
            await window.electronAPI.setBackendUrl(url);
          } else {
            await window.electronAPI.disconnect();
          }
        } catch (e) {
          console.error('Failed to set backend URL to electron store', e);
        }
      },
      removeItem: async (name: string): Promise<void> => {
        try {
          await window.electronAPI.disconnect();
        } catch (e) {
          console.error('Failed to remove backend URL from electron store', e);
        }
      },
    };
  } else {
    // Web: Use localStorage
    return {
      getItem: async (name: string): Promise<string | null> => {
        const value = localStorage.getItem(name);
        return value;
      },
      setItem: async (name: string, value: string): Promise<void> => {
        localStorage.setItem(name, value);
      },
      removeItem: async (name: string): Promise<void> => {
        localStorage.removeItem(name);
      },
    };
  }
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

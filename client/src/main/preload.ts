import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Backend Connection
  setBackendUrl: (url: string) => ipcRenderer.invoke('backend:set_url', url),
  getBackendUrl: () => ipcRenderer.invoke('backend:get_url'),
});

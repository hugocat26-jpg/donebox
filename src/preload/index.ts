import { contextBridge, ipcRenderer } from 'electron';

const sendChannels = new Set(['update-shortcut', 'update-timer']);
const listenChannels = new Set(['focus-quick-add']);

const electronApi = {
  ipcRenderer: {
    send(channel: string, value: string): void {
      if (!sendChannels.has(channel) || typeof value !== 'string') return;
      ipcRenderer.send(channel, value);
    },
    on(channel: string, listener: (...args: unknown[]) => void): (() => void) | undefined {
      if (!listenChannels.has(channel) || typeof listener !== 'function') return undefined;
      const wrappedListener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args);
      ipcRenderer.on(channel, wrappedListener);
      return () => ipcRenderer.removeListener(channel, wrappedListener);
    },
    removeAllListeners(channel: string): void {
      if (!listenChannels.has(channel)) return;
      ipcRenderer.removeAllListeners(channel);
    }
  }
};

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('electron', electronApi);
  contextBridge.exposeInMainWorld('api', {});
} else {
  window.electron = electronApi;
  window.api = {};
}

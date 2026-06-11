/// <reference types="vite/client" />

interface Window {
  electron?: {
    ipcRenderer: {
      send(channel: 'update-shortcut' | 'update-timer', value: string): void;
      on(channel: 'donebox-quick-add', listener: (...args: unknown[]) => void): (() => void) | undefined;
      removeAllListeners(channel: 'donebox-quick-add'): void;
    };
  };
  api?: Record<string, never>;
}

declare module 'lunar-javascript' {
  export const Solar: {
    fromDate(date: Date): {
      getLunar(): {
        getFestivals(): string[];
        getJieQi(): string;
      };
    };
  };
}

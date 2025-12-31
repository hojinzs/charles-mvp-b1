import { createContext, useContext, ReactNode, useMemo } from 'react';
import { detectRuntime, RuntimeEnvironment } from './runtime';
import { IStorageAdapter, INotificationAdapter } from './adapters';
import {
  ElectronStorageAdapter,
  ElectronNotificationAdapter,
} from './implementations/electron';
import {
  WebStorageAdapter,
  WebNotificationAdapter,
} from './implementations/web';

/**
 * Platform Adapters Bundle
 * Contains all platform-specific adapters
 */
export interface PlatformAdapters {
  storage: IStorageAdapter;
  notification: INotificationAdapter;
  runtime: RuntimeEnvironment;
}

/**
 * Platform Context
 * Provides access to platform adapters throughout the app
 */
const PlatformContext = createContext<PlatformAdapters | null>(null);

/**
 * Platform Provider Props
 */
interface PlatformProviderProps {
  children: ReactNode;
}

/**
 * Platform Provider Component
 * Detects runtime environment and provides appropriate adapters
 */
export function PlatformProvider({ children }: PlatformProviderProps) {
  const adapters = useMemo<PlatformAdapters>(() => {
    const runtime = detectRuntime();

    if (runtime === 'electron') {
      return {
        storage: new ElectronStorageAdapter(),
        notification: new ElectronNotificationAdapter(),
        runtime: 'electron',
      };
    } else {
      return {
        storage: new WebStorageAdapter(),
        notification: new WebNotificationAdapter(),
        runtime: 'web',
      };
    }
  }, []);

  return (
    <PlatformContext.Provider value={adapters}>
      {children}
    </PlatformContext.Provider>
  );
}

/**
 * usePlatform Hook
 * Access platform adapters in components
 * @throws Error if used outside PlatformProvider
 */
export function usePlatform(): PlatformAdapters {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within PlatformProvider');
  }
  return context;
}

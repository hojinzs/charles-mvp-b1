/**
 * Runtime environment detection
 * Detects whether the app is running in Electron or Web browser
 */

export type RuntimeEnvironment = 'electron' | 'web';

/**
 * Detect the current runtime environment
 * @returns 'electron' if electronAPI is available, 'web' otherwise
 */
export function detectRuntime(): RuntimeEnvironment {
  return typeof window !== 'undefined' && window.electronAPI !== undefined
    ? 'electron'
    : 'web';
}

/**
 * Check if running in Electron
 */
export const isElectron = detectRuntime() === 'electron';

/**
 * Check if running in Web browser
 */
export const isWeb = !isElectron;

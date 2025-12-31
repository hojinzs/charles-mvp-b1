import { INotificationAdapter } from '../../adapters/NotificationAdapter';

/**
 * Electron Notification Adapter
 * Uses Electron native notifications via IPC
 */
export class ElectronNotificationAdapter implements INotificationAdapter {
  async show(title: string, body: string): Promise<void> {
    try {
      await window.electronAPI.showNotification({ title, body });
    } catch (error) {
      console.error('Failed to show Electron notification:', error);
      // Fallback to console if notification fails
      console.log(`Notification: ${title} - ${body}`);
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    // Electron notifications don't require permission
    return 'granted';
  }

  isSupported(): boolean {
    return typeof window.electronAPI?.showNotification === 'function';
  }
}

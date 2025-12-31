import { INotificationAdapter } from '../../adapters/NotificationAdapter';

/**
 * Web Notification Adapter
 * Uses Web Notification API
 */
export class WebNotificationAdapter implements INotificationAdapter {
  async show(title: string, body: string): Promise<void> {
    if (!this.isSupported()) {
      console.warn('Web Notifications are not supported in this browser');
      return;
    }

    // Check permission
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/icon.png', // You can customize this
        badge: '/badge.png',
      });
    } else if (Notification.permission === 'default') {
      // Request permission first
      const permission = await this.requestPermission();
      if (permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/icon.png',
          badge: '/badge.png',
        });
      }
    } else {
      console.warn('Notification permission denied');
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }
    return await Notification.requestPermission();
  }

  isSupported(): boolean {
    return 'Notification' in window;
  }
}

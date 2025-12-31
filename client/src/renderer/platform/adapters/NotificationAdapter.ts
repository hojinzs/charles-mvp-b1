/**
 * Notification Adapter Interface
 * Provides unified notification API for both Electron and Web platforms
 */

export interface INotificationAdapter {
  /**
   * Show a notification
   * @param title - Notification title
   * @param body - Notification body
   */
  show(title: string, body: string): Promise<void>;

  /**
   * Request notification permission (mainly for Web)
   * @returns Promise resolving to the permission status
   */
  requestPermission(): Promise<NotificationPermission>;

  /**
   * Check if notifications are supported
   * @returns true if notifications are supported
   */
  isSupported(): boolean;
}

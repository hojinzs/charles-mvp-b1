import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';

interface SocketListenerProps {
  backendUrl: string;
}

export function SocketListener({ backendUrl }: SocketListenerProps) {
  useEffect(() => {
    if (!backendUrl) return;

    // Remove trailing slash if present for connection
    const url = backendUrl.replace(/\/$/, '');
    const socket = io(url);

    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    socket.on('rank_alert', async (data: any) => {
      console.log('Rank Alert:', data);
      
      const title = 'Charles MVP - 순위 알림';
      const body = data.message || `키워드 순위 변동 감지!`;

      // 1. Show In-App Toast
      toast.warning(body, {
        duration: 5000,
        description: `키워드 ID: ${data.keywordId} | 현재: ${data.rank}위 (목표: ${data.targetRank}위)`
      });

      // 2. Show System Notification (if window hidden or just always)
      // We'll invoke the main process handler
      if (window.electronAPI && window.electronAPI.showNotification) {
          await window.electronAPI.showNotification({ title, body });
      } else {
          // Fallback: Web Notification API (might work if permissions granted)
          if (Notification.permission === 'granted') {
             new Notification(title, { body });
          } else if (Notification.permission !== 'denied') {
             Notification.requestPermission().then(permission => {
               if (permission === 'granted') {
                 new Notification(title, { body });
               }
             });
          }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [backendUrl]);

  return null; // This component doesn't render anything
}

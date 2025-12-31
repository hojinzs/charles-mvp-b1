import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import { usePlatform } from '../platform';

interface SocketListenerProps {
  backendUrl: string;
}

export function SocketListener({ backendUrl }: SocketListenerProps) {
  const { notification } = usePlatform();
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

      // 2. Show System Notification (platform-agnostic)
      try {
        await notification.show(title, body);
      } catch (error) {
        console.error('Failed to show notification:', error);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [backendUrl, notification]);

  return null; // This component doesn't render anything
}

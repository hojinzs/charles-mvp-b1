import React, { useEffect, useState } from 'react';
import { RouterProvider, createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { RootLayout } from './routes/root';
import { MonitoringPage } from './routes/index';
import { HistoryPage } from './routes/history';
import { QueuePage } from './routes/queue';
import SetupScreen from './features/setup/SetupScreen';
import { SocketListener } from './features/SocketListener';

// 1. Create Route Tree
const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: MonitoringPage,
  validateSearch: (search: Record<string, unknown>): { page: number; limit: number; sortBy: string; order: 'asc' | 'desc'; search: string } => {
    return {
      page: Number(search.page) || 1,
      limit: Math.min(Number(search.limit) || 100, 100),
      sortBy: (search.sortBy as string) || 'created',
      order: (search.order as 'asc' | 'desc') || 'desc',
      search: (search.search as string) || '',
    };
  },
});

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: HistoryPage,
});

const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/queue',
  component: QueuePage,
});

const routeTree = rootRoute.addChildren([indexRoute, historyRoute, queueRoute]);

// 2. Create Router
const router = createRouter({ routeTree });

// 3. Register Reference
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

import { initApi, apiClient } from './lib/api';

// ... (imports remain)

const queryClient = new QueryClient();

function App() {
  const [isReady, setIsReady] = useState(false);
  const [backendUrl, setBackendUrl] = useState<string | null>(null);

  useEffect(() => {
    checkBackend();
  }, []);

  // API initialization and Backend URL management
  useEffect(() => {
    checkBackend();
  }, []);

  useEffect(() => {
    if (backendUrl) {
      initApi(backendUrl);
    }
  }, [backendUrl]);

  const checkBackend = async () => {
    try {
      const url = await window.electronAPI.getBackendUrl();
      if (url) {
        setBackendUrl(url);
        initApi(url); // Init immediately
      }
    } catch (e) {
      console.error('Failed to get backend URL', e);
    } finally {
      setIsReady(true);
    }
  };

  if (!isReady) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!backendUrl) {
    return <SetupScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SocketListener backendUrl={backendUrl} />
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  );
}

export default App;

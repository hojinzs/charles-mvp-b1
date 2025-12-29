import { createRouter, createRootRoute, createRoute } from '@tanstack/react-router';
import { RootLayout } from './routes/root';
import { MonitoringPage } from './routes/index';
import { HistoryPage } from './routes/history';
import { QueuePage } from './routes/queue';

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
export const router = createRouter({ routeTree });

// 3. Register Reference
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

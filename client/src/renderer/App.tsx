import React, { useEffect, useState } from 'react';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

// Platform
import { PlatformProvider } from './platform';

// Features
import SetupScreen from './features/setup/SetupScreen';
import { SocketListener } from './features/SocketListener';

// Lib & Store
import { initApi } from './lib/api';
import { useSettingsStore } from './store/useSettingsStore';
import { router } from './router';

const queryClient = new QueryClient();

function App() {
  const { backendUrl } = useSettingsStore();
  const [isHydrated, setIsHydrated] = useState(false);

  // 1. Hydration Check
  useEffect(() => {
     if (useSettingsStore.persist.hasHydrated()) {
       setIsHydrated(true);
     }
     
     const unsub = useSettingsStore.persist.onFinishHydration(() => {
       setIsHydrated(true);
     });

     return () => {
       unsub();
     };
  }, []);

  // 2. API Initialization
  useEffect(() => {
    if (backendUrl) {
      initApi(backendUrl);
    }
  }, [backendUrl]);

  // 3. Render Logic
  if (!isHydrated) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!backendUrl) {
    return (
      <PlatformProvider>
        <SetupScreen />
      </PlatformProvider>
    );
  }

  return (
    <PlatformProvider>
      <QueryClientProvider client={queryClient}>
        <SocketListener backendUrl={backendUrl} />
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </QueryClientProvider>
    </PlatformProvider>
  );
}

export default App;

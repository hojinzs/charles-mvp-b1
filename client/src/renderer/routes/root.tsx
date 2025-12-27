import React from 'react';
import { Outlet, Link, useRouter } from '@tanstack/react-router';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { Wifi, WifiOff, LogOut, Globe } from 'lucide-react';

export function RootLayout() {
  const router = useRouter();
  const [backendUrl, setBackendUrl] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    window.electronAPI.getBackendUrl().then(url => {
      setBackendUrl(url);
    });
  }, []);

  const health = useHealthCheck(backendUrl);

  const handleDisconnect = async () => {
    if (window.confirm('서버 연결을 해제하시겠습니까? 세팅 화면으로 돌아갑니다.')) {
      await window.electronAPI.disconnect();
      window.location.reload();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'green': return 'bg-emerald-500';
      case 'orange': return 'bg-amber-500';
      case 'red': return 'bg-rose-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-slate-800">Naver Ad Monitor POC</h1>
          
          {backendUrl && (
            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Globe size={14} className="text-slate-400" />
                  <span>{backendUrl.replace(/^https?:\/\//, '')}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(health.status)} animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.1)]`} />
                  <span className="text-[11px] font-mono text-slate-500">
                    {health.latency !== null ? `${health.latency}ms` : (health.error || 'Offline')}
                  </span>
                </div>
              </div>
              
              <div className="h-8 w-px bg-gray-100 mx-1" />
              
              <button
                onClick={handleDisconnect}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-all group relative"
                title="연결 해제"
              >
                <LogOut size={18} />
                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Disconnect
                </span>
              </button>
            </div>
          )}
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <Link 
            to="/" 
            search={{ page: 1, limit: 100, sortBy: 'created', order: 'desc', search: '' }}
            className="px-6 py-3 font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-100 transition-colors"
            activeProps={{ className: "text-blue-600 border-blue-600" }}
          >
            모니터링 (Monitoring)
          </Link>
          <Link 
            to="/history" 
            className="px-6 py-3 font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-100 transition-colors"
            activeProps={{ className: "text-blue-600 border-blue-600" }}
          >
            랭킹 히스토리 (History)
          </Link>
          <Link 
            to="/queue" 
            className="px-6 py-3 font-medium text-gray-600 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-100 transition-colors"
            activeProps={{ className: "text-blue-600 border-blue-600" }}
          >
            작업 대기열 (Queue)
          </Link>

        </div>

        {/* Content */}
        <Outlet />
      </div>
    </div>
  );
}

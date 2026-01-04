import React from 'react';
import { Outlet, Link, useRouter } from '@tanstack/react-router';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { useSettingsStore } from '../store/useSettingsStore';
import { Wifi, WifiOff, LogOut, Globe, LayoutDashboard, History, List, Settings, FileSpreadsheet } from 'lucide-react';

export function RootLayout() {
  const router = useRouter();
  const { backendUrl, clearBackendUrl } = useSettingsStore();
  
  // Removed local useEffect as data is now syncing via store

  const health = useHealthCheck(backendUrl);

  const handleDisconnect = async () => {
    if (window.confirm('서버 연결을 해제하시겠습니까? 세팅 화면으로 돌아갑니다.')) {
      clearBackendUrl();
      // Navigation is handled by App.tsx observing the store
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
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-slate-800">Naver Ad Monitor</h1>
          <p className="text-xs text-slate-500 mt-1">POC Version</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/"
            search={{ page: 1, limit: 100, sortBy: 'created', order: 'desc', search: '' }}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors"
            activeProps={{ className: "bg-blue-50 text-blue-600" }}
          >
            <LayoutDashboard size={18} />
            모니터링
          </Link>
          <Link
            to="/bulk-search"
            search={{ page: 1, limit: 50 }}
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors"
            activeProps={{ className: "bg-blue-50 text-blue-600" }}
          >
            <FileSpreadsheet size={18} />
            대량 서치
          </Link>
          <Link
            to="/history"
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors"
            activeProps={{ className: "bg-blue-50 text-blue-600" }}
          >
            <History size={18} />
            랭킹 히스토리
          </Link>
          <Link
            to="/queue"
            className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-blue-600 transition-colors"
            activeProps={{ className: "bg-blue-50 text-blue-600" }}
          >
            <List size={18} />
            작업 대기열
          </Link>

          <div className="pt-4 mt-2 border-t border-gray-100">
            <Link
              to="/system"
              className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-rose-600 transition-colors"
              activeProps={{ className: "bg-rose-50 text-rose-600" }}
            >
              <Settings size={18} />
              시스템 설정
            </Link>
          </div>
        </nav>

        {/* Connection Status & User Info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50/50">
          {backendUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Globe size={14} className="text-slate-400" />
                  <span className="truncate max-w-[120px]">{backendUrl.replace(/^https?:\/\//, '')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(health.status)} animate-pulse`} />
                  <span className="text-[10px] font-mono text-slate-500">
                    {health.latency !== null ? `${health.latency}ms` : (health.error || 'Off')}
                  </span>
                </div>
              </div>
              
              <button
                onClick={handleDisconnect}
                className="w-full flex items-center justify-center gap-2 p-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-gray-200 hover:border-rose-200 rounded-md transition-all"
              >
                <LogOut size={14} />
                연결 해제
              </button>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400">
              서버 연결 없음
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

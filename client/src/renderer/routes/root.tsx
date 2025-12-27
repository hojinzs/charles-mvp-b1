import React from 'react';
import { Outlet, Link } from '@tanstack/react-router';

export function RootLayout() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-slate-800">Naver Ad Monitor POC</h1>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 mb-6">
          <Link 
            to="/" 
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

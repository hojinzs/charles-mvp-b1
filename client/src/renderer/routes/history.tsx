import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

export function HistoryPage() {
  const { data: history = [] } = useQuery<JoinedRanking[]>({
    queryKey: ['history'],
    queryFn: apiClient.getAllHistory,
    refetchInterval: 5000,
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="p-5 font-semibold text-gray-600 text-sm">Time</th>
            <th className="p-5 font-semibold text-gray-600 text-sm">Keyword</th>
            <th className="p-5 font-semibold text-gray-600 text-sm">Target</th>
            <th className="p-5 font-semibold text-gray-600 text-sm">Rank</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {history.map((h) => (
            <tr key={h.id} className="hover:bg-gray-50 transition-colors">
              <td className="p-5 text-sm text-gray-500">
                {new Date(h.checked_at).toLocaleString()}
              </td>
              <td className="p-5 font-medium text-gray-900">{h.keyword}</td>
              <td className="p-5 text-gray-500 text-sm">{h.url}</td>
              <td className="p-5">
                {h.rank ? (
                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${h.rank <= 5 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {h.rank}위
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-500">
                    순위 없음
                  </span>
                )}
              </td>
            </tr>
          ))}
          {history.length === 0 && (
            <tr>
              <td colSpan={4} className="p-12 text-center text-gray-400">
                No history data found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

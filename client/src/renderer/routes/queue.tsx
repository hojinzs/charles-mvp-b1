import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface Job {
  id: string;
  data: {
    keyword: string;
    targetUrl: string;
  };
  status: string;
  progress: number;
}

export function QueuePage() {
  const { data: queueData } = useQuery({
    queryKey: ['queue'],
    queryFn: apiClient.getSchedulerQueue,
    refetchInterval: 3000,
  });

  const queue: Job[] = (queueData as any)?.jobs || (Array.isArray(queueData) ? queueData : []);
  const counts: Record<string, number> = (queueData as any)?.jobs ? 
    // remove jobs from queueData to get counts
    Object.fromEntries(Object.entries(queueData as any).filter(([k]) => k !== 'jobs')) as Record<string, number>
    : {};

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center">
         <div>
            <h2 className="text-lg font-semibold text-gray-800">Queue Status</h2>
            <p className="text-sm text-gray-500">Real-time job processing status</p>
         </div>
         <div className="flex gap-4">
             <div className="text-center">
                 <div className="text-2xl font-bold text-blue-600">{counts.active || 0}</div>
                 <div className="text-xs text-gray-500 uppercase">Active</div>
             </div>
             <div className="text-center">
                 <div className="text-2xl font-bold text-gray-600">{counts.waiting || 0}</div>
                 <div className="text-xs text-gray-500 uppercase">Waiting</div>
             </div>
             <div className="text-center">
                 <div className="text-2xl font-bold text-gray-400">{counts.delayed || 0}</div>
                 <div className="text-xs text-gray-500 uppercase">Delayed</div>
             </div>
         </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">
            Recent Jobs
          </h2>
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-5 font-semibold text-gray-600 text-sm w-24">ID</th>
              <th className="p-5 font-semibold text-gray-600 text-sm">Keyword</th>
              <th className="p-5 font-semibold text-gray-600 text-sm">Target URL</th>
              <th className="p-5 font-semibold text-gray-600 text-sm">Status</th>
              <th className="p-5 font-semibold text-gray-600 text-sm">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {queue.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-5 text-gray-400 font-mono text-sm">#{job.id}</td>
                <td className="p-5 font-medium text-gray-900">{job.data.keyword}</td>
                <td className="p-5 text-gray-500 text-sm">{job.data.targetUrl}</td>
                <td className="p-5">
                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase
                        ${job.status === 'active' ? 'bg-blue-100 text-blue-700' : 
                          job.status === 'completed' ? 'bg-green-100 text-green-700' : 
                          job.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}
                    `}>
                        {job.status || 'pending'}
                    </span>
                </td>
                <td className="p-5 text-sm">
                   <div className="w-full bg-gray-200 rounded-full h-2.5 max-w-[100px]">
                      <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${job.progress || 0}%` }}></div>
                   </div>
                </td>
              </tr>
            ))}
            {queue.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center text-gray-400">
                  No jobs in queue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearch } from '@tanstack/react-router';
import { useSettingsStore } from '../store/useSettingsStore';
import { Download, ArrowLeft, Loader2, CheckCircle2, Clock, XCircle, Database } from 'lucide-react';
import { toast } from 'sonner';

interface BulkSearch {
  id: number;
  name: string | null;
  filename: string;
  total_count: number;
  completed_count: number;
  pending_count: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface BulkSearchKeyword {
  id: number;
  keyword: string;
  url: string;
  status: string;
  rank: number | null;
  cached_from: string | null;
  created_at: string;
  completed_at: string | null;
}

export function BulkSearchDetailPage() {
  const { backendUrl } = useSettingsStore();
  const { id } = useParams({ from: '/bulk-search/$id' });
  const search = useSearch({ from: '/bulk-search/$id' });

  // Fetch bulk search details
  const { data: bulkSearchData, isLoading: isLoadingBulkSearch } = useQuery({
    queryKey: ['bulk-search', id],
    queryFn: async () => {
      const response = await fetch(`${backendUrl}/api/bulk-searches/${id}`);
      if (!response.ok) throw new Error('Failed to fetch bulk search');
      return response.json();
    },
    enabled: !!backendUrl && !!id,
    refetchInterval: 5000, // Refresh every 5 seconds for progress updates
  });

  // Fetch keywords
  const { data: keywordsData, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ['bulk-search-keywords', id, search.page, search.limit],
    queryFn: async () => {
      const response = await fetch(
        `${backendUrl}/api/bulk-searches/${id}/keywords?page=${search.page}&limit=${search.limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch keywords');
      return response.json();
    },
    enabled: !!backendUrl && !!id,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const bulkSearch: BulkSearch | undefined = bulkSearchData?.data;
  const keywords: BulkSearchKeyword[] = keywordsData?.data?.keywords || [];
  const total = keywordsData?.data?.total || 0;
  const totalPages = Math.ceil(total / search.limit);

  const handleExport = async () => {
    const a = document.createElement('a');
    let url: string | null = null;

    try {
      const response = await fetch(`${backendUrl}/api/bulk-searches/${id}/export`);
      if (!response.ok) throw new Error('Failed to export');

      const blob = await response.blob();
      url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = `bulk-search-${id}-results.xlsx`;
      document.body.appendChild(a);
      a.click();

      toast.success('결과가 다운로드되었습니다');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('다운로드에 실패했습니다');
    } finally {
      if (url) {
        window.URL.revokeObjectURL(url);
      }
      if (a.parentNode) {
        a.parentNode.removeChild(a);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded">
            <CheckCircle2 size={12} />
            완료
          </span>
        );
      case 'cached':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded">
            <Database size={12} />
            캐시
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded">
            <Loader2 size={12} className="animate-spin" />
            처리중
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded">
            <Clock size={12} />
            대기중
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 rounded">
            <XCircle size={12} />
            실패
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 rounded">
            {status}
          </span>
        );
    }
  };

  const getProgressPercentage = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  if (isLoadingBulkSearch) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!bulkSearch) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-rose-600">대량 서치를 찾을 수 없습니다</p>
      </div>
    );
  }

  const progress = getProgressPercentage(
    bulkSearch.completed_count,
    bulkSearch.total_count
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/bulk-search"
            search={{ page: 1, limit: 50 }}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              대량 서치 #{bulkSearch.id}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{bulkSearch.filename}</p>
          </div>
        </div>

        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download size={16} />
          엑셀 다운로드
        </button>
      </div>

      {/* Progress Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-500 mb-1">전체</p>
            <p className="text-2xl font-bold text-slate-800">
              {bulkSearch.total_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">완료</p>
            <p className="text-2xl font-bold text-emerald-600">
              {bulkSearch.completed_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">대기중</p>
            <p className="text-2xl font-bold text-amber-600">
              {bulkSearch.pending_count}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 mb-1">진행률</p>
            <p className="text-2xl font-bold text-blue-600">{progress}%</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>전체 진행 상황</span>
            <span className="font-medium">
              {bulkSearch.completed_count} / {bulkSearch.total_count}
            </span>
          </div>
          <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>
            생성일: {new Date(bulkSearch.created_at).toLocaleString('ko-KR')}
          </span>
          {bulkSearch.completed_at && (
            <span>
              완료일: {new Date(bulkSearch.completed_at).toLocaleString('ko-KR')}
            </span>
          )}
        </div>
      </div>

      {/* Keywords Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-slate-800">
            키워드 목록 ({total})
          </h2>
        </div>

        {isLoadingKeywords ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : keywords.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            키워드가 없습니다
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      키워드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      순위
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      완료 시간
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {keywords.map((kw) => (
                    <tr key={kw.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {kw.keyword}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {kw.url}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(kw.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {kw.rank ? (
                          <span className="font-semibold text-blue-600">
                            {kw.rank}위
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {kw.completed_at ? (
                          new Date(kw.completed_at).toLocaleString('ko-KR')
                        ) : kw.cached_from ? (
                          <span className="text-purple-600">
                            캐시 ({new Date(kw.cached_from).toLocaleString('ko-KR')})
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    총 {total}개 중 {(search.page - 1) * search.limit + 1}-
                    {Math.min(search.page * search.limit, total)}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to="/bulk-search/$id"
                      params={{ id }}
                      search={{ page: search.page - 1, limit: search.limit }}
                      disabled={search.page === 1}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </Link>
                    <Link
                      to="/bulk-search/$id"
                      params={{ id }}
                      search={{ page: search.page + 1, limit: search.limit }}
                      disabled={search.page >= totalPages}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

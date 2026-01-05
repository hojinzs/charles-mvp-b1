import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { useSettingsStore } from '../store/useSettingsStore';
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, Clock, XCircle } from 'lucide-react';
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

export function BulkSearchPage() {
  const { backendUrl } = useSettingsStore();
  const search = useSearch({ from: '/bulk-search' });
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // Fetch bulk searches
  const { data, isLoading, error } = useQuery({
    queryKey: ['bulk-searches', search.page, search.limit],
    queryFn: async () => {
      const response = await fetch(
        `${backendUrl}/api/bulk-searches?page=${search.page}&limit=${search.limit}`
      );
      if (!response.ok) throw new Error('Failed to fetch bulk searches');
      return response.json();
    },
    enabled: !!backendUrl,
  });

  const bulkSearches: BulkSearch[] = data?.data?.bulkSearches || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / search.limit);

  const handleDownloadTemplate = async () => {
    let url: string | null = null;
    let a: HTMLAnchorElement | null = null;
    try {
      const response = await fetch(`${backendUrl}/api/bulk-searches/template`);
      if (!response.ok) throw new Error('Failed to download template');

      const blob = await response.blob();
      url = window.URL.createObjectURL(blob);
      a = document.createElement('a');
      a.href = url;
      a.download = 'bulk-search-template.xlsx';
      document.body.appendChild(a);
      a.click();

      toast.success('템플릿이 다운로드되었습니다');
    } catch (error) {
      console.error('Template download error:', error);
      toast.error('템플릿 다운로드에 실패했습니다');
    } finally {
      if (url) {
        window.URL.revokeObjectURL(url);
      }
      if (a && a.parentNode) {
        a.parentNode.removeChild(a);
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${backendUrl}/api/bulk-searches/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      toast.success(`업로드 완료: ${result.data.totalCount}개 키워드 (캐시: ${result.data.cachedCount}, 대기: ${result.data.pendingCount})`);

      // Refresh list
      queryClient.invalidateQueries({ queryKey: ['bulk-searches'] });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`업로드 실패: ${error.message}`);
    } finally {
      setUploading(false);
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
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded">
            <Loader2 size={12} className="animate-spin" />
            처리중
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
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 rounded">
            <Clock size={12} />
            대기
          </span>
        );
    }
  };

  const getProgressPercentage = (completed: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">대량 서치</h1>
        <p className="mt-1 text-sm text-slate-500">
          엑셀 파일을 업로드하여 여러 키워드를 한 번에 검색할 수 있습니다
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={16} />
            템플릿 다운로드
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                업로드 중...
              </>
            ) : (
              <>
                <Upload size={16} />
                파일 업로드
              </>
            )}
          </button>
        </div>
      </div>

      {/* List Section */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-slate-800">
            최근 대량 서치 ({total})
          </h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-sm text-rose-600">
            데이터를 불러오는데 실패했습니다
          </div>
        ) : bulkSearches.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileSpreadsheet className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-slate-500">대량 서치 기록이 없습니다</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      파일명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      진행 상황
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {bulkSearches.map((search) => {
                    const progress = getProgressPercentage(
                      search.completed_count,
                      search.total_count
                    );

                    return (
                      <tr key={search.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {search.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet size={16} className="text-green-600" />
                            {search.filename}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span>
                                {search.completed_count} / {search.total_count}
                              </span>
                              <span className="font-medium">{progress}%</span>
                            </div>
                            <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(search.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(search.created_at).toLocaleString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            to="/bulk-search/$id"
                            params={{ id: search.id.toString() }}
                            search={{ page: 1, limit: 100 }}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            상세보기
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
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
                      to="/bulk-search"
                      search={{ page: search.page - 1, limit: search.limit }}
                      disabled={search.page === 1}
                      className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </Link>
                    <Link
                      to="/bulk-search"
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

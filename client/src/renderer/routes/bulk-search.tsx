import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearch } from '@tanstack/react-router';
import { useSettingsStore } from '../store/useSettingsStore';
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle2, Clock, XCircle, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

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

interface ValidationError {
  row: number;
  message: string;
  keyword?: string;
  url?: string;
}

interface ParsedKeyword {
  keyword: string;
  url: string;
  row: number;
}

type UploadStage = 'idle' | 'validating' | 'uploading' | 'success' | 'error';

export function BulkSearchPage() {
  const { backendUrl } = useSettingsStore();
  const search = useSearch({ from: '/bulk-search' });
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>('idle');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [validKeywordCount, setValidKeywordCount] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

  const validateFile = async (file: File): Promise<{ valid: boolean; keywords: ParsedKeyword[]; errors: ValidationError[] }> => {
    const errors: ValidationError[] = [];
    const keywords: ParsedKeyword[] = [];

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'buffer' });

      if (workbook.SheetNames.length === 0) {
        errors.push({ row: 0, message: '엑셀 파일에 시트가 없습니다.' });
        return { valid: false, keywords, errors };
      }

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

      if (jsonData.length === 0) {
        errors.push({ row: 0, message: '엑셀 파일에 데이터가 없습니다.' });
        return { valid: false, keywords, errors };
      }

      // Parse and validate each row
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        const rowNumber = i + 2; // Excel row number (1-indexed + header)

        const keyword =
          row['키워드'] ||
          row['keyword'] ||
          row['Keyword'] ||
          row['KEYWORD'] ||
          '';

        const url =
          row['URL'] ||
          row['url'] ||
          row['Url'] ||
          row['사이트'] ||
          row['웹사이트'] ||
          '';

        // Validate required fields
        if (!keyword || !url) {
          errors.push({
            row: rowNumber,
            message: '키워드 또는 URL이 비어있습니다.',
            keyword: keyword || '(없음)',
            url: url || '(없음)',
          });
          continue;
        }

        const trimmedKeyword = String(keyword).trim();
        const trimmedUrl = String(url).trim();

        if (!trimmedKeyword || !trimmedUrl) {
          errors.push({
            row: rowNumber,
            message: '키워드 또는 URL이 비어있습니다.',
            keyword: trimmedKeyword || '(없음)',
            url: trimmedUrl || '(없음)',
          });
          continue;
        }

        // Normalize URL
        let normalizedUrl = trimmedUrl;
        normalizedUrl = normalizedUrl.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
        normalizedUrl = normalizedUrl.replace(/^www\./, '');

        keywords.push({
          keyword: trimmedKeyword,
          url: normalizedUrl,
          row: rowNumber,
        });
      }

      // Check for duplicates within the file
      const seen = new Map<string, number>();

      for (const kw of keywords) {
        const key = `${kw.keyword}|${kw.url}`;
        const existingRow = seen.get(key);

        if (existingRow) {
          errors.push({
            row: kw.row,
            message: `${existingRow}번째 줄의 키워드와 중복됩니다.`,
            keyword: kw.keyword,
            url: kw.url,
          });
        } else {
          seen.set(key, kw.row);
        }
      }

      return {
        valid: errors.length === 0,
        keywords,
        errors,
      };
    } catch (e: any) {
      errors.push({
        row: 0,
        message: `파일 읽기 오류: ${e.message}`,
      });
      return { valid: false, keywords, errors };
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setShowModal(true);
    setUploadStage('idle');
    setValidationErrors([]);
    setValidKeywordCount(0);

    // Clear input
    event.target.value = '';
  };

  const handleUploadConfirm = async () => {
    if (!selectedFile) return;

    try {
      // Stage 1: Validating
      setUploadStage('validating');
      setValidationErrors([]);

      const { valid, keywords, errors } = await validateFile(selectedFile);

      if (!valid) {
        setValidationErrors(errors);
        setUploadStage('error');
        return;
      }

      setValidKeywordCount(keywords.length);

      // Stage 2: Uploading
      setUploadStage('uploading');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${backendUrl}/api/bulk-searches/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();

      // Stage 3: Success
      setUploadStage('success');

      // Refresh list
      queryClient.invalidateQueries({ queryKey: ['bulk-searches'] });

      // Auto close after 2 seconds
      setTimeout(() => {
        handleCloseModal();
        toast.success(`업로드 완료: ${result.data.totalCount}개 키워드 (캐시: ${result.data.cachedCount}, 대기: ${result.data.pendingCount})`);
      }, 2000);
    } catch (error: any) {
      console.error('Upload error:', error);
      setValidationErrors([{ row: 0, message: error.message || '업로드 중 오류가 발생했습니다.' }]);
      setUploadStage('error');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedFile(null);
    setUploadStage('idle');
    setValidationErrors([]);
    setValidKeywordCount(0);
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
            onChange={handleFileSelect}
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Upload size={16} />
            파일 업로드
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

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-slate-800">대량 서치 업로드</h2>
              <button
                onClick={handleCloseModal}
                disabled={uploadStage === 'validating' || uploadStage === 'uploading'}
                className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Idle Stage */}
              {uploadStage === 'idle' && selectedFile && (
                <div className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded border border-gray-200">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">선택된 파일:</span> {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      크기: {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <p className="text-sm text-gray-600">
                    업로드 버튼을 클릭하면 파일 검증 후 업로드가 시작됩니다.
                  </p>
                </div>
              )}

              {/* Validating Stage */}
              {uploadStage === 'validating' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-lg font-medium text-gray-700">파일 체크중입니다...</p>
                  <p className="text-sm text-gray-500 mt-2">잠시만 기다려주세요</p>
                </div>
              )}

              {/* Uploading Stage */}
              {uploadStage === 'uploading' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-lg font-medium text-gray-700">파일 업로드중입니다...</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {validKeywordCount}개의 키워드를 업로드하고 있습니다
                  </p>
                </div>
              )}

              {/* Success Stage */}
              {uploadStage === 'success' && (
                <div className="flex flex-col items-center justify-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
                  <p className="text-lg font-medium text-gray-700">업로드 완료!</p>
                  <p className="text-sm text-gray-500 mt-2">
                    {validKeywordCount}개의 키워드가 성공적으로 업로드되었습니다
                  </p>
                </div>
              )}

              {/* Error Stage */}
              {uploadStage === 'error' && validationErrors.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded">
                    <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-rose-800">
                        {validationErrors.length}개의 오류가 발견되었습니다
                      </p>
                      <p className="text-sm text-rose-700 mt-1">
                        아래 오류를 수정한 후 다시 업로드해주세요
                      </p>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {validationErrors.map((error, index) => (
                      <div
                        key={index}
                        className="p-3 bg-white border border-rose-200 rounded text-sm"
                      >
                        {error.row > 0 && (
                          <p className="font-medium text-rose-800 mb-1">
                            {error.row}번째 줄
                          </p>
                        )}
                        <p className="text-gray-700">{error.message}</p>
                        {error.keyword && error.url && (
                          <div className="mt-2 text-xs text-gray-600">
                            <p>키워드: {error.keyword}</p>
                            <p>URL: {error.url}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              {uploadStage === 'idle' && (
                <>
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleUploadConfirm}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                  >
                    <Upload size={16} />
                    업로드
                  </button>
                </>
              )}

              {uploadStage === 'error' && (
                <>
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  >
                    닫기
                  </button>
                  <button
                    onClick={() => {
                      setUploadStage('idle');
                      setValidationErrors([]);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                  >
                    다시 시도
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

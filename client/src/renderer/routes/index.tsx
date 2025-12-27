import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { utils, writeFile } from 'xlsx';
import { apiClient } from '../lib/api';
import { BulkUploadModal } from '../components/BulkUploadModal';
import { KeywordModal } from '../components/KeywordModal';
import { useMonitoringState, SortField } from '../hooks/useMonitoringState';

export function MonitoringPage() {
  const queryClient = useQueryClient();
  const [newKeyword, setNewKeyword] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isKeywordModalOpen, setIsKeywordModalOpen] = useState(false);
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { page, limit, sortBy, order, search, setPage, setSort, setSearch } = useMonitoringState();
  const [tagSearch, setTagSearch] = useState('');
  
  // Local state for inputs to support "Search" button click
  const [localSearch, setLocalSearch] = useState(search);
  const [localTagSearch, setLocalTagSearch] = useState('');
  
  // Query: Fetch Keywords
  const { data, isLoading } = useQuery<{ keywords: Keyword[], total: number }>({
    queryKey: ['keywords', page, limit, sortBy, order, search, tagSearch],
    queryFn: () => apiClient.getKeywords({ 
        page, 
        limit, 
        sortBy, 
        order, 
        search: search, // This is the "committed" search
        tag: tagSearch 
    }),
    refetchInterval: 1000 * 10,
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(localSearch);
    setTagSearch(localTagSearch);
    setPage(1); // Reset to first page on new search
  };

  const keywords = data?.keywords || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // Mutations
  const addMutation = useMutation({
    mutationFn: (data: { keyword: string; url: string }) => 
      apiClient.addKeyword(data.keyword, data.url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      setNewKeyword('');
      setNewUrl('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteKeywords,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      setSelectedIds(new Set());
    },
  });

  const priorityMutation = useMutation({
    mutationFn: (ids: number[]) => apiClient.enqueuePriority(ids),
    onSuccess: (data) => {
      alert("우선 요청되었습니다");
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      alert(`Failed to request priority: ${err.message}`);
    }
  });

  // Handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === keywords.length && keywords.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(keywords.map(k => k.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} keywords?`)) return;
    deleteMutation.mutate(Array.from(selectedIds));
  };

  const handlePriorityRequest = async () => {
    if (selectedIds.size === 0) return;
    priorityMutation.mutate(Array.from(selectedIds));
  };

  const handleFastAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword || !newUrl) return;
    addMutation.mutate({ keyword: newKeyword, url: newUrl });
  };

  const openAddModal = () => {
    setEditingKeyword(null);
    setIsKeywordModalOpen(true);
  };

  const openEditModal = (keyword: Keyword) => {
    setEditingKeyword(keyword);
    setIsKeywordModalOpen(true);
  };

  // Sort Click Handler
  // Cycle: Asc -> Desc -> Default (Created Desc)
  const handleSortClick = (field: SortField) => {
    if (sortBy === field) {
      if (order === 'asc') {
        setSort(field, 'desc');
      } else {
        // Reset to default
        setSort('created', 'desc');
      }
    } else {
      setSort(field, 'asc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return <span className="text-gray-300 ml-1">⇅</span>;
    return order === 'asc' ? <span className="ml-1 text-blue-600">⬇️</span> : <span className="ml-1 text-blue-600">⬆️</span>;
  };

  const handleDownload = async () => {
      try {
          setIsDownloading(true);
          // Fetch all data matching current filter
          // Use a sufficiently large limit
          const response = await apiClient.getKeywords({
              page: 1,
              limit: 999999, // Fetch all matches
              sortBy,
              order,
              search,
              tag: tagSearch
          });

          const allKeywords = response.keywords || [];

          if (allKeywords.length === 0) {
              alert("다운로드할 데이터가 없습니다.");
              return;
          }

          // Format data for Excel
          const excelData = allKeywords.map((k: any) => ({
              '키워드': k.keyword,
              'URL': k.url,
              '태그': k.tags ? k.tags.join(', ') : '',
              '현재 순위': k.last_rank ? `${k.last_rank}위` : '순위 없음',
              '마지막 확인': k.last_checked_at ? format(new Date(k.last_checked_at), 'yyyy-MM-dd HH:mm:ss') : '-'
          }));

          const ws = utils.json_to_sheet(excelData);
          const wb = utils.book_new();
          utils.book_append_sheet(wb, ws, "키워드모니터링결과");

          // Filename: YYYYMMDD_키워드모니터링결과.xlsx
          const filename = `${format(new Date(), 'yyyyMMdd')}_키워드모니터링결과.xlsx`;
          writeFile(wb, filename);

      } catch (err: any) {
          console.error("Download failed", err);
          alert(`다운로드 실패: ${err.message}`);
      } finally {
          setIsDownloading(false);
      }
  };

  return (
    <>
    {/* Fast Add Form */}
    <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Fast Add</h2>
    <div className="flex flex-col gap-4 mb-6">
      <form onSubmit={handleFastAdd} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4 items-end">
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="Keyword" 
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
          />
        </div>
        <div className="flex-1">
          <input 
            type="text" 
            placeholder="URL / Title Match" 
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
          />
        </div>
        <div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm text-sm whitespace-nowrap">
            Quick Add
          </button>
        </div>
      </form>
    </div>

    {/* Toolbar */}
    <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
             <button 
                onClick={openAddModal}
                className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition font-medium shadow-sm text-sm flex items-center gap-2"
              >
                <span>+</span> Add Keyword
              </button>
              <button 
                onClick={() => setIsBulkModalOpen(true)}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50"
              >
                <span>📊</span> Bulk Upload
              </button>
              <button 
                onClick={handleDownload}
                disabled={isDownloading}
                className="text-sm font-medium text-gray-600 hover:text-green-600 transition flex items-center gap-2 bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                <span>📥</span> {isDownloading ? 'Downloading...' : 'Download Results'}
              </button>
        </div>
    </div>

      {/* Bulk Upload Modal */}
      <BulkUploadModal 
        isOpen={isBulkModalOpen} 
        onClose={() => setIsBulkModalOpen(false)} 
      />
      <KeywordModal
        isOpen={isKeywordModalOpen}
        onClose={() => setIsKeywordModalOpen(false)}
        initialData={editingKeyword}
      />

      {/* Filters & Search */}
    <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-4 mb-4 justify-between items-end">
      <div className="flex gap-2 items-end flex-1">
           <div className="flex-1 max-w-xs">
               <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Keyword Search</label>
               <input 
                  type="text" 
                  placeholder="Search keywords..." 
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
               />
           </div>
           <div className="flex-1 max-w-xs">
               <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Tag Search</label>
               <input 
                  type="text" 
                  placeholder="Search tags..." 
                  value={localTagSearch}
                  onChange={(e) => setLocalTagSearch(e.target.value)}
                  className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
               />
           </div>
           <button 
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-bold shadow-sm text-sm h-[38px]"
           >
              Search
           </button>
      </div>
      
      {/* Pagination Info */}
      <div className="text-sm text-gray-500">
        Total <strong>{total}</strong> keywords (Page {page} of {totalPages || 1})
      </div>
    </form>

      {/* List Actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4 bg-blue-50 p-4 rounded-lg flex items-center justify-between border border-blue-100 animate-fade-in">
          <span className="text-blue-700 font-medium text-sm">{selectedIds.size} keywords selected</span>
          <div className="flex gap-2">
            <button 
              onClick={handlePriorityRequest}
              disabled={priorityMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              {priorityMutation.isPending ? 'Processing...' : '우선 요청'}
            </button>
            <button 
              onClick={handleDeleteSelected}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold shadow-sm"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-5 w-12">
                <input 
                  type="checkbox" 
                  checked={keywords.length > 0 && selectedIds.size === keywords.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                />
              </th>
              <th 
                className="p-5 font-semibold text-gray-600 text-sm cursor-pointer hover:bg-gray-100 transition select-none"
                onClick={() => handleSortClick('keyword')}
              >
                Keyword {renderSortIcon('keyword')}
              </th>
              <th className="p-5 font-semibold text-gray-600 text-sm">Target URL</th>
              <th 
                className="p-5 font-semibold text-gray-600 text-sm cursor-pointer hover:bg-gray-100 transition select-none"
                onClick={() => handleSortClick('rank')}
              >
                Current Rank {renderSortIcon('rank')}
              </th>
              <th 
                className="p-5 font-semibold text-gray-600 text-sm cursor-pointer hover:bg-gray-100 transition select-none"
                onClick={() => handleSortClick('lastChecked')}
              >
                Last Checked {renderSortIcon('lastChecked')}
              </th>
              <th className="p-5 font-semibold text-gray-600 text-sm w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
               <tr><td colSpan={6} className="p-8 text-center text-gray-400">Loading...</td></tr>
            ) : keywords.map((k) => (
              <tr key={k.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(k.id) ? 'bg-blue-50/50' : ''}`}>
                <td className="p-5">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(k.id)}
                    onChange={() => toggleSelect(k.id)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                  />
                </td>
                <td className="p-5 font-medium text-gray-900">
                    <div>{k.keyword}</div>
                    {k.tags && k.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                            {k.tags.map((tag: any, i: number) => (
                                <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{tag}</span>
                            ))}
                        </div>
                    )}
                </td>
                <td className="p-5 text-gray-500 text-sm">{k.url}</td>
                <td className="p-5">
                  {k.last_rank ? (
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${k.last_rank <= 5 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {k.last_rank}위
                      </span>
                      {k.target_rank && k.last_rank > k.target_rank && (
                          <span className="text-[10px] text-red-500 font-bold" title={`Goal: ${k.target_rank}위`}>⚠️</span>
                      )}
                    </div>
                  ) : k.last_checked_at ? (
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-500">
                      순위 없음
                    </span>
                  ) : (
                    <span className="text-gray-300 text-sm">• 대기중</span>
                  )}
                </td>
                <td className="p-5 text-sm text-gray-400">
                  {k.last_checked_at ? (
                    <span title={format(new Date(k.last_checked_at), 'yyyy-MM-dd HH:mm')}>
                      {formatDistanceToNow(new Date(k.last_checked_at), { addSuffix: true, locale: ko })}
                    </span>
                  ) : '-'}
                </td>
                <td className="p-5">
                    <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(k); }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                        title="Edit"
                    >
                        ✏️
                    </button>
                </td>
              </tr>
            ))}
            {!isLoading && keywords.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-400">
                  No keywords found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-center gap-2 mb-8">
        <button
          onClick={() => setPage(Math.max(1, page - 1))}
          disabled={page === 1}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium bg-white"
        >
          Previous
        </button>
        <span className="flex items-center px-4 text-sm font-medium text-gray-600">
          Page {page} of {totalPages || 1}
        </span>
        <button
          onClick={() => setPage(Math.min(totalPages || 1, page + 1))}
          disabled={page >= (totalPages || 1)}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium bg-white"
        >
          Next
        </button>
      </div>
    </>
  );
}
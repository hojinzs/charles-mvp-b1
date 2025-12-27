import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { apiClient } from '../lib/api';
import { BulkUploadModal } from '../components/BulkUploadModal';

  
  import { useMonitoringState, SortField } from '../hooks/useMonitoringState';

  // ... imports

  export function MonitoringPage() {
    const queryClient = useQueryClient();
    const [newKeyword, setNewKeyword] = useState('');
    const [newUrl, setNewUrl] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // Use custom hook for URL state
    const { page, limit, sortBy, order, search, setPage, setSort, setSearch } = useMonitoringState();
    const [debouncedSearch, setDebouncedSearch] = useState(search);

    // Debounce search
    React.useEffect(() => {
      const timer = setTimeout(() => setDebouncedSearch(search), 500);
      return () => clearTimeout(timer);
    }, [search]);

    // Query: Fetch Keywords
    const { data, isLoading } = useQuery<{ keywords: Keyword[], total: number }>({
      queryKey: ['keywords', page, limit, sortBy, order, debouncedSearch],
      queryFn: () => apiClient.getKeywords({ page, limit, sortBy, order, search: debouncedSearch }),
      refetchInterval: 1000 * 10,
    });

    const keywords = data?.keywords || [];
    const total = data?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Mutations ... (keep existing mutations)
    const addMutation = useMutation({
      mutationFn: (data: { keyword: string; url: string }) => 
        apiClient.addKeyword(data.keyword, data.url),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['keywords'] });
        setNewKeyword('');
        setNewUrl('');
      },
    });
  
    // ... mutations
  
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

    // Handlers ... (keep existing handlers)
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
  
    const handleAdd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newKeyword || !newUrl) return;
      addMutation.mutate({ keyword: newKeyword, url: newUrl });
    };

    // ... template and upload handlers (keep existing)
    // ... template and upload handlers (moved to component)

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
      return order === 'asc' ? <span className="ml-1 text-blue-600">⬆️</span> : <span className="ml-1 text-blue-600">⬇️</span>;
    };

    return (
      <>
        {/* Form */}
        {/* Form and Bulk Toggle */}
        <div className="flex flex-col gap-4 mb-8">
          <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Keyword</label>
              <input 
                type="text" 
                placeholder="e.g. 꽃배달" 
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                className="w-full border border-gray-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Display URL / Title Match</label>
              <input 
                type="text" 
                placeholder="e.g. 99flower" 
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="w-full border border-gray-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>
            <div className="flex items-end">
              <button type="submit" className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition font-medium shadow-sm active:scale-95 transform">
                Monitor
              </button>
            </div>
          </form>

          <div className="flex justify-end">
            <button 
              onClick={() => setIsBulkModalOpen(true)}
              className="text-xs font-bold text-gray-400 hover:text-blue-600 transition uppercase tracking-wider flex items-center gap-1 bg-gray-50 px-3 py-2 rounded-md hover:bg-blue-50"
            >
              <span>📊</span> Bulk Upload (Excel)
            </button>
          </div>
        </div>

        {/* Bulk Upload Modal */}
        <BulkUploadModal 
          isOpen={isBulkModalOpen} 
          onClose={() => setIsBulkModalOpen(false)} 
        />
  
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4 justify-between items-end">
          <div className="w-64">
             <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Search</label>
             <input 
                type="text" 
                placeholder="Search keywords..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border border-gray-200 p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
             />
          </div>
          
          {/* Pagination Info */}
          <div className="text-sm text-gray-500">
            Total <strong>{total}</strong> keywords (Page {page} of {totalPages || 1})
          </div>
        </div>
  
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                 <tr><td colSpan={5} className="p-8 text-center text-gray-400">Loading...</td></tr>
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
                  <td className="p-5 font-medium text-gray-900">{k.keyword}</td>
                  <td className="p-5 text-gray-500">{k.url}</td>
                  <td className="p-5">
                    {k.last_rank ? (
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${k.last_rank <= 5 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {k.last_rank}위
                      </span>
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
                </tr>
              ))}
              {!isLoading && keywords.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-gray-400">
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
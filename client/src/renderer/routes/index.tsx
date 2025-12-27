import React, { useState } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { apiClient } from '../lib/api';



export function MonitoringPage() {
  const queryClient = useQueryClient();
  const [newKeyword, setNewKeyword] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Query: Fetch Keywords
  const { data: keywords = [] } = useQuery<Keyword[]>({
    queryKey: ['keywords'],
    queryFn: apiClient.getKeywords,
    refetchInterval: 1000 * 10,
  });

  // Mutation: Add Keyword
  const addMutation = useMutation({
    mutationFn: (data: { keyword: string; url: string }) => 
      apiClient.addKeyword(data.keyword, data.url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      setNewKeyword('');
      setNewUrl('');
    },
  });

  // Mutation: Add Bulk
  const addBulkMutation = useMutation({
    mutationFn: apiClient.addKeywordsBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      alert("Keywords added successfully!");
    },
  });

  // Mutation: Delete
  const deleteMutation = useMutation({
    mutationFn: apiClient.deleteKeywords,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      setSelectedIds(new Set());
    },
  });

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword || !newUrl) return;
    addMutation.mutate({ keyword: newKeyword, url: newUrl });
  };

  const handleDownloadTemplate = () => {
    const ws = utils.json_to_sheet([
      { keyword: "예시_키워드", displayURL: "example.com" }
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "monitoring_template.xlsx");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const wb = read(arrayBuffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = utils.sheet_to_json<{keyword: string, displayURL: string}>(ws);

      const itemsToAdd = jsonData
        .filter(item => item.keyword && item.displayURL)
        .map(item => ({
          keyword: String(item.keyword).trim(),
          url: String(item.displayURL).trim()
        }));

      if (itemsToAdd.length > 0) {
        addBulkMutation.mutate(itemsToAdd);
      } else {
        alert("No valid data found in file.");
      }
      
      // Reset input
      e.target.value = '';
    } catch (err) {
      console.error("Failed to process file", err);
      alert("Failed to process file.");
    }
  };

  return (
    <>
      {/* Helper Text */}
      <div className="bg-blue-50 text-blue-800 p-4 rounded-lg mb-6 text-sm">
        <p>ℹ️ Scheduler runs every 1 minute. Add a keyword below and wait for the "Rank" and "Last Check" to update.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleAdd} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8 flex gap-4">
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

      {/* Bulk Upload */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
        <h3 className="text-sm font-semibold text-gray-600 mb-4 uppercase">Bulk Upload (Excel)</h3>
        <div className="flex gap-4 items-center">
          <button 
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
          >
            <span>📥</span> Download Template
          </button>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-50 file:text-blue-700
                hover:file:bg-blue-100
              "
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          * Use the template to upload multiple keywords at once. Columns: <code>keyword</code>, <code>displayURL</code>.
        </p>
      </div>

      {/* List Actions */}
      {selectedIds.size > 0 && (
        <div className="mb-4 bg-red-50 p-4 rounded-lg flex items-center justify-between border border-red-100 animate-fade-in">
          <span className="text-red-700 font-medium text-sm">{selectedIds.size} keywords selected</span>
          <button 
            onClick={handleDeleteSelected}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-semibold shadow-sm"
          >
            Delete Selected
          </button>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
              <th className="p-5 font-semibold text-gray-600 text-sm">Keyword</th>
              <th className="p-5 font-semibold text-gray-600 text-sm">Target URL</th>
              <th className="p-5 font-semibold text-gray-600 text-sm">Current Rank</th>
              <th className="p-5 font-semibold text-gray-600 text-sm">Last Checked</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {keywords.map((k) => (
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
            {keywords.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center text-gray-400">
                  No keywords are being monitored.
                  <br/>Add one to start tracking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

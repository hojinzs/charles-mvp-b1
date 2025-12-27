import React from 'react';
import { read, utils, writeFile } from 'xlsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BulkUploadModal({ isOpen, onClose }: BulkUploadModalProps) {
  const queryClient = useQueryClient();

  // Mutation: Bulk Add Keywords
  const addBulkMutation = useMutation({
    mutationFn: apiClient.addKeywordsBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      alert("Keywords added successfully!");
      onClose(); // Close modal on success
    },
    onError: (err: any) => {
      alert(`Failed to upload keywords: ${err.message}`);
    }
  });

  // Handler: Download Template
  const handleDownloadTemplate = () => {
    const ws = utils.json_to_sheet([
      { keyword: "예시_키워드", displayURL: "example.com" }
    ]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Template");
    writeFile(wb, "monitoring_template.xlsx");
  };

  // Handler: File Upload
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
      
      e.target.value = '';
    } catch (err) {
      console.error("Failed to process file", err);
      alert("Failed to process file.");
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800">Bulk Upload</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition text-2xl"
          >
            &times;
          </button>
        </div>
        
        <div className="p-8">
          <div className="flex flex-col gap-6">
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <p className="text-xs text-blue-700 font-medium mb-3">1. 템플릿을 다운로드하여 양식에 맞게 작성하세요.</p>
              <button 
                onClick={handleDownloadTemplate}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-blue-600 rounded-lg border border-blue-200 hover:bg-blue-50 transition text-sm font-bold shadow-sm"
              >
                <span>📥</span> Download Template
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <p className="text-xs text-gray-600 font-medium mb-3">2. 작성한 파일을 업로드하세요 (xlsx, csv)</p>
              <div className="relative">
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  disabled={addBulkMutation.isPending}
                  className="block w-full text-sm text-gray-500
                    file:mr-4 file:py-2.5 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-bold
                    file:bg-blue-600 file:text-white
                    hover:file:bg-blue-700
                    file:cursor-pointer
                    disabled:opacity-50
                  "
                />
              </div>
            </div>
            {addBulkMutation.isPending && (
              <p className="text-center text-sm text-blue-600 font-medium animate-pulse">
                등록 중입니다... 잠시만 기다려 주세요.
              </p>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 leading-relaxed italic">
              * Columns: <code>keyword</code>, <code>displayURL</code>. <br/>
              * 최대 1000개까지 한번에 등록 가능합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      setUploadResult(data); // Save result to state
    },
    onError: (err: any) => {
      alert(`Failed to upload keywords: ${err.message}`);
    }
  });

  const [uploadResult, setUploadResult] = React.useState<any>(null);
  const [showDetails, setShowDetails] = React.useState(false);

  // Handler: Download Template
  const handleDownloadTemplate = () => {
    const ws = utils.json_to_sheet([
      { keyword: "예시_키워드", displayURL: "example.com", tags: "태그1,태그2", targetRank: "5" },
      { keyword: "예시_키워드2", displayURL: "example.com", tags: "", targetRank: "" }
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
      const jsonData = utils.sheet_to_json<any>(ws);

      const itemsToAdd = jsonData
        .filter(item => item.keyword && item.displayURL)
        .map(item => ({
          keyword: String(item.keyword).trim(),
          url: String(item.displayURL).trim(),
          tags: item.tags ? String(item.tags).split(',').map(t => t.trim()) : [],
          targetRank: item.targetRank ? parseInt(item.targetRank) : undefined
        }));

      if (itemsToAdd.length > 0) {
        setUploadResult(null); // Reset previous result
        setShowDetails(false);
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

  const handleClose = () => {
    setUploadResult(null);
    setShowDetails(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" 
      onClick={handleClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-scale-in max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-800">Bulk Upload</h3>
          <button 
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition text-2xl"
          >
            &times;
          </button>
        </div>
        
        <div className="p-8 overflow-y-auto">
          {!uploadResult ? (
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
                      file:disabled:opacity-50
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
          ) : (
            <div className="flex flex-col gap-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <h4 className="text-green-800 font-bold text-lg mb-1">Upload Completed</h4>
                <div className="flex justify-center gap-4 text-sm mt-3">
                   <div className="flex flex-col">
                      <span className="text-gray-500 uppercase text-[10px] font-bold">Total</span>
                      <span className="text-gray-800 font-bold text-xl">{uploadResult.stats.total}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-green-600 uppercase text-[10px] font-bold">Success</span>
                      <span className="text-green-700 font-bold text-xl">{uploadResult.stats.success}</span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-red-500 uppercase text-[10px] font-bold">Failed</span>
                      <span className="text-red-600 font-bold text-xl">{uploadResult.stats.failed}</span>
                   </div>
                </div>
              </div>
              
              {uploadResult.stats.failed > 0 && (
                <div className="w-full">
                   <button 
                     onClick={() => setShowDetails(!showDetails)}
                     className="w-full py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition border border-red-100 mb-2"
                   >
                     {showDetails ? "Hide Error Details" : "Show Error Details"}
                   </button>
                   
                   {showDetails && (
                     <div className="bg-gray-50 rounded-lg p-3 max-h-60 overflow-y-auto border border-gray-200">
                        {uploadResult.results.filter((r: any) => r.status === 'rejected').map((r: any, idx: number) => (
                           <div key={idx} className="mb-2 last:mb-0 pb-2 border-b border-gray-100 last:border-0">
                              <p className="text-xs font-bold text-gray-700">{r.item.keyword} ({r.item.url})</p>
                              <p className="text-[11px] text-red-500 mt-0.5">{r.reason}</p>
                           </div>
                        ))}
                     </div>
                   )}
                </div>
              )}

              <button 
                onClick={handleClose}
                className="w-full py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-black transition shadow-lg shadow-gray-200 mt-2"
              >
                Close
              </button>
            </div>
           )}

          {!uploadResult && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 leading-relaxed italic">
                * Columns: <code>keyword</code>, <code>displayURL</code>, <code>tags</code> (optional, comma-separated), <code>targetRank</code> (optional, number). <br/>
                * 100건씩 나누어 처리됩니다. (대량 등록 시 시간이 소요될 수 있습니다)
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

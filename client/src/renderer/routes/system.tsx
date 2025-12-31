import React, { useState } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { AlertTriangle, Trash2, CheckCircle2 } from 'lucide-react';

export function SystemPage() {
  const { backendUrl } = useSettingsStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSystemReset = async () => {
    // 1st Confirmation
    if (!window.confirm("경고: 정말로 시스템을 초기화하시겠습니까?\n이 작업은 모든 키워드, 랭킹 이력, 작업 대기열을 영구적으로 삭제합니다.")) {
      return;
    }
    
    // 2nd Confirmation
    if (!window.confirm("확인: 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      return;
    }

    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      if (!backendUrl) throw new Error("Backend URL is not configured");

      const response = await fetch(`${backendUrl}/api/system/reset`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "System reset failed");
      }

      setSuccess("시스템이 성공적으로 초기화되었습니다.");
      
      // Force reload after a short delay to clear any local state in queries
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">시스템 설정</h1>
        <p className="text-slate-500 mt-2">시스템 동작 환경을 관리하고 데이터를 제어합니다.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50/50">
          <div className="flex items-center gap-3 text-rose-600">
             <AlertTriangle size={24} />
             <h2 className="text-lg font-semibold">위험 구역 (Danger Zone)</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1 ml-9">
            데이터 삭제 및 시스템 초기화 관련 기능입니다. 신중하게 사용해주세요.
          </p>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-medium text-slate-900">시스템 데이터 초기화</h3>
              <p className="text-sm text-slate-500 mt-1">
                등록된 모든 키워드, 순위 검색 이력, 작업 대기열을 완전히 삭제합니다.
                <br />
                <span className="text-rose-600 font-medium">이 작업은 복구할 수 없습니다.</span>
              </p>
            </div>
            
            <button
              onClick={handleSystemReset}
              disabled={loading || !backendUrl}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white shadow-sm transition-all
                ${loading || !backendUrl 
                  ? 'bg-gray-300 cursor-not-allowed' 
                  : 'bg-rose-600 hover:bg-rose-700 hover:shadow-md active:transform active:scale-95'}
              `}
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
              시스템 초기화
            </button>
          </div>

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700 flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {success && (
             <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
               <CheckCircle2 size={16} />
               {success}
               <span className="text-Emerald-600/70 text-xs ml-auto">(2초 후 새로고침...)</span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

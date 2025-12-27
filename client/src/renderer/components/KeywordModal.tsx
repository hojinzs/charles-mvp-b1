import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';

interface KeywordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Keyword | null; // If present, Edit mode
}

export function KeywordModal({ isOpen, onClose, initialData }: KeywordModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!initialData;

  const [keyword, setKeyword] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [targetRank, setTargetRank] = useState('');

  useEffect(() => {
    if (initialData) {
      setKeyword(initialData.keyword);
      setUrl(initialData.url);
      setTags(initialData.tags ? initialData.tags.join(', ') : '');
      setTargetRank(initialData.target_rank ? String(initialData.target_rank) : '');
    } else {
      resetForm();
    }
  }, [initialData, isOpen]);

  const resetForm = () => {
    setKeyword('');
    setUrl('');
    setTags('');
    setTargetRank('');
  };

  const mutation = useMutation({
    mutationFn: (data: any) => {
       const payload = {
           keyword: data.keyword,
           url: data.url,
           tags: data.tags ? data.tags.split(',').map((t:string) => t.trim()).filter(Boolean) : [],
           targetRank: data.targetRank ? parseInt(data.targetRank) : undefined
       };
       if (isEdit && initialData) {
           return apiClient.updateKeyword(initialData.id, payload);
       } else {
           return apiClient.addKeyword(payload.keyword, payload.url, payload.tags, payload.targetRank);
       }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keywords'] });
      resetForm();
      onClose();
    },
    onError: (err: any) => {
        alert(err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword || !url) return;
    mutation.mutate({ keyword, url, tags, targetRank });
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
          <h3 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Edit Keyword' : 'Add Keyword'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition text-2xl">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Keyword</label>
              <input 
                type="text" 
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. 꽃배달"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Target URL</label>
              <input 
                type="text" 
                value={url}
                onChange={e => setUrl(e.target.value)}
                className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="e.g. 99flower.com"
                required
              />
            </div>
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Tags</label>
                    <input 
                        type="text" 
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                        className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Tag1, Tag2"
                    />
                </div>
                <div className="w-1/3">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Rank Alert</label>
                    <input 
                        type="number" 
                        value={targetRank}
                        onChange={e => setTargetRank(e.target.value)}
                        className="w-full border border-gray-200 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Target"
                    />
                </div>
            </div>

            <div className="flex justify-end gap-2 mt-4">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                >
                    Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={mutation.isPending}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-bold shadow-sm disabled:opacity-70"
                >
                    {mutation.isPending ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}

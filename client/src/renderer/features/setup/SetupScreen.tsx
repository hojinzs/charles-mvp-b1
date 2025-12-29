import React, { useState } from 'react';

import { apiClient, initApi } from '../../lib/api';
import { useSettingsStore } from '../../store/useSettingsStore';

const SetupScreen: React.FC = () => {
  const [url, setUrl] = useState('http://localhost:3000');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const setBackendUrl = useSettingsStore((state) => state.setBackendUrl);

  const handleConnect = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      initApi(url);
      const response = await apiClient.checkConnection(url);
      if (response.success) {
        setBackendUrl(url);
        // App component will react to store change and re-render
      } else {
        setError(response.message || 'Connection failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h1 className="mb-4 text-2xl font-bold text-center">Backend Setup</h1>
        <p className="mb-4 text-gray-600">Enter the URL of the Backend API.</p>
        
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:3000"
          className="w-full px-4 py-2 mb-4 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        
        {error && (
          <div className="p-2 mb-4 text-sm text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}
        
        <button
          onClick={handleConnect}
          disabled={isLoading}
          className={`w-full px-4 py-2 text-white rounded focus:outline-none ${
            isLoading ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isLoading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  );
};

export default SetupScreen;

import React from 'react';

interface ErrorScreenProps {
  message?: string;
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ message = '服务不可用' }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-[#1c1c1e] rounded-2xl shadow-2xl p-12 flex flex-col items-center justify-center min-w-[320px] max-w-md">
        <div className="bg-red-500/20 p-4 rounded-full mb-6">
            <div className="bg-red-500 w-2 h-8 rounded-full mb-1 mx-auto"></div>
            <div className="bg-red-500 w-2 h-2 rounded-full mx-auto"></div>
        </div>
        {/* Or use Lucide icon if preferred, but custom shape described was specific */}
        {/* <AlertCircle size={48} className="text-red-500 mb-6" /> */}
        
        <h1 className="text-white text-xl font-bold tracking-wide">{message}</h1>
        <p className="text-gray-500 text-xs mt-4 max-w-xs text-center break-all">
            {message === '服务不可用' ? 'Check .env file and console logs.' : ''}
        </p>
      </div>
    </div>
  );
};

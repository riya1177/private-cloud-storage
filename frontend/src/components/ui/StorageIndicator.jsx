import React from 'react';
import { HardDrive, Files } from 'lucide-react';

/**
 * Format bytes into human readable string (KB, MB, GB)
 */
export const formatBytes = (bytes, decimals = 1) => {
  if (bytes === 0 || !bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const StorageIndicator = ({ files = [], className = '' }) => {
  // Sum size from real backend files
  const totalSizeBytes = files.reduce((acc, file) => acc + (file.size || 0), 0);
  const formattedSize = formatBytes(totalSizeBytes);
  const totalFiles = files.length;

  return (
    <div className={`p-4 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-xl transition-colors duration-200 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">
            Storage Used
          </span>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
          {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
        </span>
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
          {formattedSize}
        </div>
        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 gap-1 transition-colors">
          <Files className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>Real-time pool</span>
        </div>
      </div>
    </div>
  );
};

export default StorageIndicator;

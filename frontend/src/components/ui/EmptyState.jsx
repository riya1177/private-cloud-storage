import React from 'react';
import { FolderOpen, Upload } from 'lucide-react';

const EmptyState = ({
  title = 'No files found',
  description = 'Your cloud storage is currently empty. Upload files to get started.',
  onUploadClick,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-white/50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-800 my-4 animate-fade-in transition-colors">
      <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-slate-900 text-slate-400 border border-indigo-100 dark:border-slate-800 mb-4 shadow-sm">
        <FolderOpen className="w-10 h-10 text-indigo-600 dark:text-indigo-400/80" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-1 transition-colors">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed transition-colors">
        {description}
      </p>
      {onUploadClick && (
        <button
          onClick={onUploadClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all duration-150 shadow-md shadow-indigo-600/20 active:scale-[0.98]"
        >
          <Upload className="w-4 h-4" />
          <span>Upload New File</span>
        </button>
      )}
    </div>
  );
};

export default EmptyState;

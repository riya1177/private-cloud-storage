import React, { useState, useRef, useEffect } from 'react';
import FileIcon from './FileIcon';
import { formatBytes } from '../ui/StorageIndicator';
import { MoreVertical, Download, Edit3, Trash2, Share2 } from 'lucide-react';

const formatDate = (isoString) => {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return isoString;
  }
};

const FileRow = ({ file, onDownload, onRenameClick, onDeleteClick, onShareClick }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <div className="group relative flex items-center justify-between p-3.5 bg-white/80 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700/80 rounded-xl transition-all duration-150 shadow-sm">
      {/* File Info */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
        <FileIcon filename={file.filename} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
            {file.filename}
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span>{formatBytes(file.size)}</span>
            {file.owner && (
              <>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span>By {file.owner}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Date */}
      <div className="hidden sm:block text-xs text-slate-500 dark:text-slate-400 shrink-0 px-4">
        {formatDate(file.uploaded_at)}
      </div>

      {/* Action Menu Trigger */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-1.5 rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors focus:outline-none"
          title="File Options"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {/* Action Dropdown Menu */}
        {isMenuOpen && (
          <div className="absolute right-0 top-8 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1.5 animate-pop-in">
            <button
              onClick={() => {
                setIsMenuOpen(false);
                onDownload(file.filename);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-600/10 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors text-left font-medium"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Download</span>
            </button>

            {onShareClick && (
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  onShareClick(file);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left font-medium"
              >
                <Share2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Share</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsMenuOpen(false);
                onRenameClick(file);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left font-medium"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-400" />
              <span>Rename</span>
            </button>

            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

            <button
              onClick={() => {
                setIsMenuOpen(false);
                onDeleteClick(file);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors text-left font-medium"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FileRow;

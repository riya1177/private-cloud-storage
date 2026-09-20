import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { Edit3, Loader2 } from 'lucide-react';

const RenameModal = ({ isOpen, onClose, file, onRename, isRenaming }) => {
  const [newFilename, setNewFilename] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (file) {
      setNewFilename(file.filename || '');
      setError('');
    }
  }, [file, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = newFilename.trim();
    if (!trimmed) {
      setError('Filename cannot be empty.');
      return;
    }
    if (trimmed === file?.filename) {
      onClose();
      return;
    }
    onRename(file.id, trimmed);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rename File" maxWidth="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 transition-colors">
            File Name
          </label>
          <input
            type="text"
            value={newFilename}
            onChange={(e) => {
              setNewFilename(e.target.value);
              setError('');
            }}
            placeholder="Enter new file name"
            disabled={isRenaming}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            autoFocus
          />
          {error && <p className="mt-1.5 text-xs text-rose-500 dark:text-rose-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isRenaming}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isRenaming}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {isRenaming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default RenameModal;

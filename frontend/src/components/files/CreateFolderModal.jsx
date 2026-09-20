// src/components/files/CreateFolderModal.jsx
import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { FolderPlus } from 'lucide-react';
import axios from 'axios';

const CreateFolderModal = ({ isOpen, onClose, onFolderCreated }) => {
  const { showSuccess, showError } = useToast();
  const [folderName, setFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = folderName.trim();
    if (!cleanName) {
      showError('Please enter a folder name.');
      return;
    }

    setIsCreating(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      const res = await axios.post(
        'http://localhost:8000/folders',
        { name: cleanName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showSuccess(`Folder "${cleanName}" created successfully!`);
      setFolderName('');
      onClose();
      if (onFolderCreated) onFolderCreated(res.data.folder);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to create folder.';
      showError(msg);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Folder" maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
            <FolderPlus className="w-4 h-4 text-indigo-500" />
            Folder Name
          </label>
          <input
            type="text"
            placeholder="e.g. Resumes, Certificates, Tax Documents"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            autoFocus
            className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create Folder'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateFolderModal;
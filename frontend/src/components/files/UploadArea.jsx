import React, { useState, useRef } from 'react';
import { uploadFile } from '../../api/files';
import { useToast } from '../../context/ToastContext';
import { UploadCloud, File, CloudDownload } from 'lucide-react';
import { formatBytes } from '../ui/StorageIndicator';
import GoogleDriveImportModal from './GoogleDriveImportModal';

const UploadArea = ({ onUploadSuccess }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);
  const fileInputRef = useRef(null);

  const { showSuccess, showError } = useToast();

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      startUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      startUpload(e.target.files[0]);
    }
  };

  const startUpload = async (file) => {
    setSelectedFile(file);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      await uploadFile(file, (progress) => {
        setUploadProgress(progress);
      });

      showSuccess(`File "${file.filename || file.name}" uploaded successfully.`);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      console.error('Upload error:', err);
      let errMsg = 'Failed to upload file. Please try again.';
      if (err.response && err.response.data && err.response.data.detail) {
        errMsg = err.response.data.detail;
      }
      showError(errMsg, 'Upload Failed');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setSelectedFile(null);
        setUploadProgress(0);
      }, 1000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="w-full space-y-3">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        id="cloud-file-input"
      />

      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-300 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/50 bg-white/60 dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900/70'
        }`}
      >
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mb-3 border border-indigo-100 dark:border-indigo-500/20">
          <UploadCloud className="w-7 h-7" />
        </div>

        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1 transition-colors">
          {isDragging ? 'Drop file here to upload' : 'Click to upload or drag & drop'}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 transition-colors">
          All file types supported • Maximum security
        </p>

        {/* Action Buttons for Add File */}
        <div className="flex items-center justify-center gap-3 pt-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload from Computer</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDriveModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
          >
            <CloudDownload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Import from Google Drive</span>
          </button>
        </div>

        {/* Uploading Progress Box */}
        {selectedFile && (
          <div className="w-full max-w-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 mt-4 animate-fade-in shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 mb-2">
              <div className="flex items-center gap-2 truncate pr-2">
                <File className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate font-medium">{selectedFile.name}</span>
                <span className="text-slate-400 dark:text-slate-400 text-[11px]">({formatBytes(selectedFile.size)})</span>
              </div>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 shrink-0">{uploadProgress}%</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-150 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Google Drive Import Modal */}
      <GoogleDriveImportModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onImportSuccess={() => {
          if (onUploadSuccess) onUploadSuccess();
        }}
      />
    </div>
  );
};

export default UploadArea;

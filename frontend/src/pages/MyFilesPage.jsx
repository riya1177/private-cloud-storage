import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import FileRow from '../components/files/FileRow';
import UploadArea from '../components/files/UploadArea';
import EmptyState from '../components/ui/EmptyState';
import Modal from '../components/ui/Modal';
import ShareModal from '../components/files/ShareModal';
import CreateFolderModal from '../components/files/CreateFolderModal';
import { SkeletonFileRow } from '../components/ui/Skeleton';
import { Upload, Search, RefreshCw, Folder, Camera, FileText, FolderPlus } from 'lucide-react';
import axios from 'axios';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'mp4', 'mkv', 'webm', 'avi', 'mov', 'mp3', 'wav'];
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'rtf', 'json', 'md'];

const isImageFile = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return IMAGE_EXTENSIONS.includes(ext);
};

const isDocFile = (filename = '') => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return DOC_EXTENSIONS.includes(ext);
};

const MyFilesPage = ({
  files = [],
  isLoading = false,
  searchQuery = '',
  onSearchChange,
  refreshFiles,
  onDownload,
  onRenameClick,
  onDeleteClick,
  isUploadModalOpen = false,
  setIsUploadModalOpen,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCategory = searchParams.get('category') || 'all'; // 'all' | 'photos' | 'docs'

  // Share modal target state
  const [shareTarget, setShareTarget] = useState(null);

  // Folder management state
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Fetch folders from backend on mount
  const fetchFolders = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
      if (!token) return;
      const res = await axios.get('http://localhost:8000/folders', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFolders(res.data || []);
    } catch (err) {
      console.error('Failed to load folders:', err);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  const photoCount = files.filter((f) => isImageFile(f.filename)).length;
  const docCount = files.filter((f) => isDocFile(f.filename)).length;

  // Filter files by folder selection first
  const folderFilteredFiles = files.filter((file) => {
    if (selectedFolderId === null) return true;
    return file.folder_id === selectedFolderId;
  });

  // Filter files by category tab second
  const categoryFilteredFiles = folderFilteredFiles.filter((file) => {
    if (currentCategory === 'photos') return isImageFile(file.filename);
    if (currentCategory === 'docs') return isDocFile(file.filename);
    return true;
  });

  // Filter files by search query third
  const filteredFiles = categoryFilteredFiles.filter((file) =>
    file.filename?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCategoryTabChange = (categoryKey) => {
    if (categoryKey === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ category: categoryKey });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
            My Files
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">
            Showing {filteredFiles.length} of {files.length} {files.length === 1 ? 'file' : 'files'} stored in your cloud pool
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              refreshFiles();
              fetchFolders();
            }}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 transition-colors disabled:opacity-50 shadow-sm"
            title="Refresh file list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-500 dark:text-indigo-400' : ''}`} />
          </button>

          {/* New Folder Button */}
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 font-medium text-xs transition-all shadow-sm active:scale-[0.98]"
          >
            <FolderPlus className="w-4 h-4 text-indigo-500" />
            <span>New Folder</span>
          </button>

          {/* Upload File Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-[0.98]"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* User Folders Row (If Available) */}
      {folders.length > 0 && (
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Folders
          </label>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                selectedFolderId === null
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>All Folders</span>
            </button>

            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  selectedFolderId === folder.id
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <Folder className="w-3.5 h-3.5 text-amber-500" />
                <span>{folder.name}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ml-0.5">
                  {folder.file_count || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 dark:border-slate-800/80 pb-3 overflow-x-auto">
        <button
          onClick={() => handleCategoryTabChange('all')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 shrink-0 ${
            currentCategory === 'all'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <Folder className="w-3.5 h-3.5" />
          <span>All Files</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ml-1">
            {files.length}
          </span>
        </button>

        <button
          onClick={() => handleCategoryTabChange('photos')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 shrink-0 ${
            currentCategory === 'photos'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Photos & Media</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ml-1">
            {photoCount}
          </span>
        </button>

        <button
          onClick={() => handleCategoryTabChange('docs')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 shrink-0 ${
            currentCategory === 'docs'
              ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Documents</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 ml-1">
            {docCount}
          </span>
        </button>
      </div>

      {/* Mobile Search Bar */}
      <div className="block sm:hidden">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
        </div>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Upload File"
        maxWidth="max-w-lg"
      >
        <UploadArea
          onUploadSuccess={() => {
            refreshFiles();
            fetchFolders();
            setIsUploadModalOpen(false);
          }}
        />
      </Modal>

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onFolderCreated={(newFolder) => {
          setFolders((prev) => [...prev, newFolder]);
          fetchFolders();
        }}
      />

      {/* File List Table Container */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonFileRow />
          <SkeletonFileRow />
          <SkeletonFileRow />
          <SkeletonFileRow />
        </div>
      ) : filteredFiles.length === 0 ? (
        <EmptyState
          title={
            searchQuery
              ? 'No matching files found'
              : currentCategory === 'photos'
              ? 'No photo or media files found'
              : currentCategory === 'docs'
              ? 'No document files found'
              : 'No files in repository'
          }
          description={
            searchQuery
              ? `No files match your query "${searchQuery}". Try a different keyword.`
              : currentCategory === 'photos'
              ? 'Upload your first photo or video to view it here.'
              : currentCategory === 'docs'
              ? 'Upload your first PDF or document to view it here.'
              : 'Upload your first file to your private cloud storage.'
          }
          onUploadClick={() => setIsUploadModalOpen(true)}
        />
      ) : (
        <div className="space-y-2.5">
          {/* Table Header Bar */}
          <div className="hidden sm:flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">
            <span className="flex-1">Name</span>
            <span className="w-36 text-left px-4">Uploaded</span>
            <span className="w-12 text-right">Actions</span>
          </div>

          {/* File Rows */}
          {filteredFiles.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              onDownload={onDownload}
              onRenameClick={onRenameClick}
              onDeleteClick={onDeleteClick}
              onShareClick={(f) => setShareTarget(f)}
            />
          ))}
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        file={shareTarget}
      />
    </div>
  );
};

export default MyFilesPage;
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ImageThumbnail from '../components/files/ImageThumbnail';
import ImagePreviewModal from '../components/files/ImagePreviewModal';
import FileRow from '../components/files/FileRow';
import UploadArea from '../components/files/UploadArea';
import ShareModal from '../components/files/ShareModal';
import CreateFolderModal from '../components/files/CreateFolderModal';
import { SkeletonFileRow } from '../components/ui/Skeleton';
import { getFrequentlyUsedFiles } from '../api/files';

import {
  Image as ImageIcon,
  FileText,
  Folder,
  ArrowRight,
  Camera,
  Layers,
  UploadCloud,
  FolderPlus,
} from 'lucide-react';

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

const DashboardPage = ({
  files = [],
  isLoading = false,
  searchQuery = '',
  refreshFiles,
  onDownload,
  onRenameClick,
  onDeleteClick,
}) => {
  const { username } = useAuth();
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showQuickUpload, setShowQuickUpload] = useState(false);
  const [frequentlyUsed, setFrequentlyUsed] = useState([]);
  const [frequentlyLoading, setFrequentlyLoading] = useState(true);

  // Modal States
  const [shareTarget, setShareTarget] = useState(null);
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);

  // Helper search filter
  const matchesSearch = (filename = '') =>
    !searchQuery || filename.toLowerCase().includes(searchQuery.toLowerCase().trim());

  // Filter real files from GET /files
  const searchFilteredFiles = files.filter((f) => matchesSearch(f.filename));
  const photoFiles = searchFilteredFiles.filter((f) => isImageFile(f.filename));
  const docFiles = searchFilteredFiles.filter((f) => isDocFile(f.filename));

  // Filtered photo files list
  const displayPhotos = photoFiles.slice(0, 8);

  // Recent files list (sorted by upload date)
  const recentFiles = [...searchFilteredFiles]
    .sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))
    .slice(0, 5);

  // Load frequently used files calling GET /files/frequently-used
  const loadFrequentlyUsed = async () => {
    try {
      setFrequentlyLoading(true);
      const data = await getFrequentlyUsedFiles();
      if (Array.isArray(data)) {
        setFrequentlyUsed(data.filter((file) => (file.access_count || 0) > 0));
      } else {
        setFrequentlyUsed([]);
      }
    } catch (error) {
      console.error('Failed to load frequently used files:', error);
      setFrequentlyUsed([]);
    } finally {
      setFrequentlyLoading(false);
    }
  };

  useEffect(() => {
    loadFrequentlyUsed();
  }, [files]);

  const displayFrequentlyUsed = frequentlyUsed.filter((f) => matchesSearch(f.filename));

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Redesigned Welcome Section */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
          Welcome back, <span className="text-indigo-600 dark:text-indigo-400">{username || 'User'}</span>
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 transition-colors">
          Your files, photos and documents — all in one private place.
        </p>
      </div>

      {/* 2. Quick Access Shortcuts */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider transition-colors">
            Quick Access
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          {/* Photos Shortcut */}
          <Link
            to="/files?category=photos"
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-400/40 transition-all duration-200 group flex flex-col justify-between h-28 hover:-translate-y-0.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {files.filter((f) => isImageFile(f.filename)).length}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                Photos
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Media gallery</p>
            </div>
          </Link>

          {/* Documents Shortcut */}
          <Link
            to="/files?category=docs"
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-sky-400/40 transition-all duration-200 group flex flex-col justify-between h-28 hover:-translate-y-0.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {files.filter((f) => isDocFile(f.filename)).length}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-300 transition-colors">
                Documents
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">PDFs & text files</p>
            </div>
          </Link>

          {/* All Files Link */}
          <Link
            to="/files"
            className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-emerald-400/40 transition-all duration-200 group flex flex-col justify-between h-28 hover:-translate-y-0.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                <Folder className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                {files.length}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition-colors">
                All Files
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Browse complete pool</p>
            </div>
          </Link>

          {/* New Folder Quick Action */}
          <button
            onClick={() => setIsFolderModalOpen(true)}
            className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-500/10 hover:bg-amber-100/70 dark:hover:bg-amber-500/20 border border-amber-200 dark:border-amber-500/30 transition-all duration-200 group flex flex-col justify-between h-28 text-left hover:-translate-y-0.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
                <FolderPlus className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Create
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                New Folder
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Resumes, Docs, etc.</p>
            </div>
          </button>

          {/* Add File Action */}
          <button
            onClick={() => setShowQuickUpload(!showQuickUpload)}
            className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-600/15 hover:bg-indigo-100/70 dark:hover:bg-indigo-600/25 border border-indigo-200 dark:border-indigo-500/30 transition-all duration-200 group flex flex-col justify-between h-28 text-left hover:-translate-y-0.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/20 group-hover:scale-105 transition-transform">
                <UploadCloud className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Upload
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                Add File
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Drag & drop media</p>
            </div>
          </button>
        </div>

        {/* Collapsible Inline Quick Upload area */}
        {showQuickUpload && (
          <div className="pt-2 animate-slide-up">
            <UploadArea
              onUploadSuccess={() => {
                refreshFiles();
                setShowQuickUpload(false);
              }}
            />
          </div>
        )}
      </div>

      {/* 3. Photo / Media Gallery Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 transition-colors">
              Recent Photos & Media
            </h3>
          </div>
          {photoFiles.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 transition-colors">
              Showing {displayPhotos.length} of {photoFiles.length} photos
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl bg-slate-200/70 dark:bg-slate-900/60 border border-slate-300/60 dark:border-slate-800 animate-pulse"
              />
            ))}
          </div>
        ) : photoFiles.length === 0 ? (
          /* Empty Photo State */
          <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-white/50 dark:bg-slate-900/30 border border-dashed border-slate-300 dark:border-slate-800/80 transition-colors">
            <Camera className="w-8 h-8 text-slate-400 dark:text-slate-500 mb-2 opacity-80" />
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
              {searchQuery ? 'No matching photos found' : 'No photos yet'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-3 leading-relaxed">
              {searchQuery
                ? `No photos match query "${searchQuery}".`
                : 'Upload your first photo to build your personal gallery.'}
            </p>
          </div>
        ) : (
          /* Photo Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5 sm:gap-4">
            {displayPhotos.map((file) => (
              <div
                key={file.id}
                onClick={() => setSelectedPhoto(file)}
                className="group relative aspect-square rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 overflow-hidden cursor-pointer hover:border-indigo-500/50 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              >
                <ImageThumbnail
                  filename={file.filename}
                  alt={file.filename}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-end">
                  <p className="text-xs font-medium text-white truncate">{file.filename}</p>
                  <p className="text-[10px] text-slate-300 mt-0.5">Click for preview</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Recent Files Section */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 transition-colors">
              Recent Documents & Files
            </h3>
          </div>
          <Link
            to="/files"
            className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors group"
          >
            <span>View all files</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <SkeletonFileRow />
            <SkeletonFileRow />
            <SkeletonFileRow />
          </div>
        ) : recentFiles.length === 0 ? (
          <div className="p-6 text-center bg-white/50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl text-xs text-slate-500 dark:text-slate-400 transition-colors">
            {searchQuery ? `No files match query "${searchQuery}".` : 'No files available in repository.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            {recentFiles.map((file) => (
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
      </div>

      {/* 5. Frequently Used Files */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 transition-colors">
                Frequently Used
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">
                Files you access most often
              </p>
            </div>
          </div>
        </div>

        {frequentlyLoading ? (
          <div className="space-y-3">
            <SkeletonFileRow />
            <SkeletonFileRow />
            <SkeletonFileRow />
          </div>
        ) : displayFrequentlyUsed.length === 0 ? (
          <div className="p-6 text-center bg-white/50 dark:bg-slate-900/30 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl transition-colors">
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              {searchQuery ? 'No matching frequently used files' : 'No frequently used files yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Open or download files to see them here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {displayFrequentlyUsed.map((file) => (
              <button
                key={file.id}
                onClick={() => onDownload?.(file.filename)}
                className="group text-left p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900 hover:border-indigo-400/40 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/15 transition-colors">
                    {isImageFile(file.filename) ? (
                      <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    ) : isDocFile(file.filename) ? (
                      <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                    ) : (
                      <Folder className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                      {file.filename}
                    </p>

                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Opened {file.access_count || 0}{' '}
                        {(file.access_count || 0) === 1 ? 'time' : 'times'}
                      </span>

                      {file.last_accessed && (
                        <>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            {new Date(file.last_accessed).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 6. Image Preview Modal */}
      <ImagePreviewModal
        isOpen={Boolean(selectedPhoto)}
        onClose={() => setSelectedPhoto(null)}
        file={selectedPhoto}
        onDownload={onDownload}
      />

      {/* 7. Create Folder Modal */}
      <CreateFolderModal
        isOpen={isFolderModalOpen}
        onClose={() => setIsFolderModalOpen(false)}
        onFolderCreated={() => {
          if (refreshFiles) refreshFiles();
        }}
      />

      {/* 8. Share File Modal */}
      <ShareModal
        isOpen={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        file={shareTarget}
      />
    </div>
  );
};

export default DashboardPage;
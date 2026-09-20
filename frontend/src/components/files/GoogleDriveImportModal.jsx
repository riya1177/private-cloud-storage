import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { getGoogleDriveStatus, getGoogleDriveAuthUrl, getGoogleDriveFiles, importGoogleDriveFile } from '../../api/googleDrive';
import { formatBytes } from '../ui/StorageIndicator';
import { Cloud, FileText, Download, AlertTriangle, ExternalLink, RefreshCw, CheckCircle2, Lock } from 'lucide-react';
import axios from 'axios';

const GoogleDriveImportModal = ({ isOpen, onClose, onImportSuccess }) => {
  const { showSuccess, showError } = useToast();

  const [isConfigured, setIsConfigured] = useState(true);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [driveFiles, setDriveFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [importingFileId, setImportingFileId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      handleOAuthCallbackAndLoad();
    }
  }, [isOpen]);

  // Handles checking URL for OAuth 'code' redirect or simply loading files
  const handleOAuthCallbackAndLoad = async () => {

    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    setIsLoadingStatus(true);

    try {
      // 1. If we just redirected back from Google OAuth with a code parameter
      if (code) {
        setIsConnecting(true);
        // Exchange code with backend /google-callback endpoint
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        await axios.get(`http://localhost:8000/google-callback?code=${code}&state=${state}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Clean up query params from URL bar cleanly without triggering reloads
        window.history.replaceState({}, document.title, window.location.pathname);
        showSuccess('Google Drive connected successfully!');
      }

      // 2. Check general status & load files
      const status = await getGoogleDriveStatus();
      setIsConfigured(status.configured);

      if (status.configured) {
        await loadDriveFiles();
      }
    } catch (err) {
      console.error('Google Drive initialization error:', err);
      setIsConfigured(false);
    } finally {
      setIsLoadingStatus(false);
      setIsConnecting(false);
    }
  };

  const loadDriveFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const data = await getGoogleDriveFiles();
      if (Array.isArray(data.files)) {
        setDriveFiles(data.files);
      } else if (Array.isArray(data)) {
        setDriveFiles(data);
      }
    } catch (err) {
      console.error('Failed to load Google Drive files:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      const data = await getGoogleDriveAuthUrl();
      if (data.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err) {
      console.error('Google auth error:', err);
      showError('Failed to initiate Google OAuth login.', 'Auth Error');
    }
  };

  const handleImport = async (driveFile) => {
    setImportingFileId(driveFile.id);
    try {
      await importGoogleDriveFile({
        file_id: driveFile.id,
        filename: driveFile.name,
        mime_type: driveFile.mimeType,
      });

      showSuccess(`File "${driveFile.name}" imported and encrypted successfully.`);
      if (onImportSuccess) {
        onImportSuccess();
      }
      onClose();
    } catch (err) {
      console.error('Import error:', err);
      let msg = 'Failed to import file from Google Drive.';
      if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      }
      showError(msg, 'Import Error');
    } finally {
      setImportingFileId(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import from Google Drive" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {isLoadingStatus || isConnecting ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
            <span>{isConnecting ? 'Completing Google Drive connection...' : 'Checking Google Drive configuration...'}</span>
          </div>
        ) : !isConfigured ? (
          /* Unconfigured Google OAuth Notice */
          <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-3">
            <div className="flex items-center gap-2.5 text-amber-800 dark:text-amber-300 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Google Drive Integration Not Configured</span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Google Drive import is not configured yet. Please configure Google OAuth credentials in your backend .env file.
            </p>
            <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-amber-200/80 dark:border-amber-900/40 text-[11px] font-mono text-slate-700 dark:text-slate-300 space-y-1">
              <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Required .env Variables:</p>
              <p>GOOGLE_CLIENT_ID=your_google_client_id</p>
              <p>GOOGLE_CLIENT_SECRET=your_google_client_secret</p>
              <p>GOOGLE_REDIRECT_URI=http://localhost:3000/google-callback</p>
            </div>
          </div>
        ) : (
          /* Configured State */
          <div className="space-y-4">
            {/* Header / Connect Banner */}
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Google Drive Cloud Storage
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Import files into Private Cloud Storage with end-to-end encryption.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleConnectGoogleDrive}
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Connect Drive</span>
              </button>
            </div>

            {/* Drive Files List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Accessible Drive Files
                </h4>
                <button
                  type="button"
                  onClick={loadDriveFiles}
                  disabled={isLoadingFiles}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingFiles ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingFiles ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
                  Loading files from Google Drive...
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    No Google Drive files found or Google Drive is not connected yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleConnectGoogleDrive}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                  >
                    <span>Click here to authorize Google Drive</span>
                  </button>
                </div>
              ) : (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {driveFiles.map((file) => (
                    <div
                      key={file.id}
                      className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {file.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {file.size > 0 ? formatBytes(file.size) : file.isGoogleDoc ? 'Google Doc (Auto-Exports to PDF/Doc)' : 'Cloud File'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleImport(file)}
                        disabled={importingFileId === file.id}
                        className="px-3 py-1.5 text-xs font-medium bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-lg transition-all border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-1.5 shrink-0"
                      >
                        {importingFileId === file.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <Download className="w-3 h-3" />
                        )}
                        <span>{importingFileId === file.id ? 'Importing...' : 'Import'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default GoogleDriveImportModal;
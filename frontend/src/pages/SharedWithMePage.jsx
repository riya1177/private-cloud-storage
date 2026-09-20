import React, { useState, useEffect } from 'react';
import { getSharedWithMe, downloadPublicSharedFile, verifyPublicSharePassword } from '../api/share';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { formatBytes } from '../components/ui/StorageIndicator';
import { Users, Download, Lock, Calendar, FileText, Ban, Eye, KeyRound, X } from 'lucide-react';

const formatDate = (isoString) => {
  if (!isoString) return 'Never';
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

const SharedWithMePage = () => {
  const [shares, setShares] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  // Password Modal state for protected files
  const [selectedShare, setSelectedShare] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    fetchSharedWithMe();
  }, []);

  const fetchSharedWithMe = async () => {
    setIsLoading(true);
    try {
      const data = await getSharedWithMe();
      if (Array.isArray(data)) {
        setShares(data);
      }
    } catch (err) {
      console.error('Failed to fetch files shared with me:', err);
      showError('Failed to load files shared with you.', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadClick = (share) => {
    if (!share.download_allowed) {
      showError('Download has been restricted by the owner of this file.', 'Restricted');
      return;
    }

    if (share.password_protected) {
      setSelectedShare(share);
      setPasswordInput('');
    } else {
      executeDownload(share);
    }
  };

  const executeDownload = async (share, password = null) => {
    setDownloadingId(share.share_id);
    try {
      showSuccess(`Downloading "${share.filename}"...`);
      await downloadPublicSharedFile(share.share_token, share.filename, password);
      showSuccess(`Downloaded "${share.filename}" successfully.`);
      if (selectedShare) {
        setSelectedShare(null);
        setPasswordInput('');
      }
    } catch (err) {
      console.error('Download error:', err);
      let msg = 'Failed to download shared file.';
      if (err.response?.status === 401) {
        msg = 'Incorrect password for this shared file.';
      } else if (err.response?.status === 403) {
        msg = 'Download is disabled by the file owner.';
      }
      showError(msg, 'Download Error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordInput.trim() || !selectedShare) return;

    setIsVerifying(true);
    try {
      await verifyPublicSharePassword(selectedShare.share_token, passwordInput);
      await executeDownload(selectedShare, passwordInput);
    } catch (err) {
      console.error('Password verify error:', err);
      showError(err.response?.data?.detail || 'Incorrect password.', 'Authentication Failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Shared with Me
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Files that other users have securely shared with your account email address.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : shares.length === 0 ? (
        <EmptyState
          title="No Shared Files Found"
          description="When another user shares a file directly with your email address, it will appear here."
          icon={Users}
        />
      ) : (
        <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">File Name</th>
                  <th className="p-4">Shared By</th>
                  <th className="p-4">Date Received</th>
                  <th className="p-4">Expires</th>
                  <th className="p-4">Security</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {shares.map((share) => (
                  <tr key={share.share_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/60 transition-colors">
                    {/* File Name */}
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {share.filename}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            {formatBytes(share.size)}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Shared By */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center uppercase shrink-0">
                          {share.shared_by ? share.shared_by.charAt(0) : 'U'}
                        </div>
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {share.shared_by}
                        </span>
                      </div>
                    </td>

                    {/* Date Received */}
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {formatDate(share.created_at)}
                    </td>

                    {/* Expires */}
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {formatDate(share.expires_at)}
                    </td>

                    {/* Security Info */}
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {share.password_protected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60">
                            <Lock className="w-3 h-3" /> Password
                          </span>
                        )}
                        {!share.download_allowed && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/60">
                            <Ban className="w-3 h-3" /> No Download
                          </span>
                        )}
                        {share.download_allowed && !share.password_protected && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60">
                            Ready
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      {share.download_allowed ? (
                        <button
                          onClick={() => handleDownloadClick(share)}
                          disabled={downloadingId === share.share_id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-xs shadow-sm transition-all"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{downloadingId === share.share_id ? 'Downloading...' : 'Download'}</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                          View Only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Password Dialog for Protected File Download */}
      {selectedShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Password Protected File
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter password to download "{selectedShare.filename}"
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedShare(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Share Password
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter required password"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedShare(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !passwordInput.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-xs shadow-sm transition-all"
                >
                  {isVerifying ? 'Verifying...' : 'Unlock & Download'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedWithMePage;

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPublicSharedFileInfo, verifyPublicSharePassword, downloadPublicSharedFile } from '../api/share';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/ui/Skeleton';
import { formatBytes } from '../components/ui/StorageIndicator';
import { Share2, Download, Lock, KeyRound, AlertCircle, Cloud, ShieldCheck, CheckCircle2, FileText, Ban } from 'lucide-react';

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

const PublicSharePage = () => {
  const { shareToken } = useParams();
  const { showSuccess, showError } = useToast();

  const [fileInfo, setFileInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Password Verification State
  const [password, setPassword] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (shareToken) {
      fetchFileInfo();
    }
  }, [shareToken]);

  const fetchFileInfo = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await getPublicSharedFileInfo(shareToken);
      setFileInfo(data);
      if (!data.requires_password) {
        setIsUnlocked(true);
      }
    } catch (err) {
      console.error('Failed to load shared file metadata:', err);
      const detail = err.response?.data?.detail || 'This share link is invalid, expired, or revoked.';
      setErrorMsg(detail);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsVerifying(true);
    try {
      await verifyPublicSharePassword(shareToken, password);
      setIsUnlocked(true);
      showSuccess('Access granted to shared file.');
    } catch (err) {
      console.error('Password verification error:', err);
      showError(err.response?.data?.detail || 'Incorrect password.', 'Access Denied');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownload = async () => {
    if (!fileInfo || !fileInfo.download_allowed) {
      showError('Download is disabled by the owner for this file.', 'Restricted');
      return;
    }

    setIsDownloading(true);
    try {
      showSuccess(`Preparing download for "${fileInfo.filename}"...`);
      await downloadPublicSharedFile(shareToken, fileInfo.filename, fileInfo.requires_password ? password : null);
      showSuccess(`Downloaded "${fileInfo.filename}" successfully.`);
    } catch (err) {
      console.error('Download error:', err);
      showError(err.response?.data?.detail || 'Failed to download shared file.', 'Download Error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-6 lg:p-8 transition-colors">
      {/* Header */}
      <header className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Private Cloud Storage
            </h1>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Secure Encrypted Sharing
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>End-to-End Encrypted</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md w-full mx-auto my-auto py-8">
        {isLoading ? (
          <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 shadow-xl space-y-6">
            <Skeleton className="h-12 w-12 rounded-2xl mx-auto" />
            <Skeleton className="h-6 w-3/4 mx-auto rounded-lg" />
            <Skeleton className="h-4 w-1/2 mx-auto rounded-lg" />
            <Skeleton className="h-12 w-full rounded-2xl" />
          </div>
        ) : errorMsg ? (
          /* Error / Expired State */
          <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 shadow-xl text-center space-y-5 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 flex items-center justify-center mx-auto border border-rose-200/80 dark:border-rose-800/60">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Unavailable Share Link
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed max-w-xs mx-auto">
                {errorMsg}
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Go to App Login
            </Link>
          </div>
        ) : !isUnlocked ? (
          /* Password Protected Prompt */
          <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 shadow-xl space-y-6 animate-fade-in">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200/80 dark:border-amber-800/60 shadow-sm">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Password Protected File
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This shared link requires a password set by <span className="font-semibold text-slate-700 dark:text-slate-300">{fileInfo.owner}</span>.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Enter Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter share password"
                    required
                    autoFocus
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isVerifying || !password.trim()}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2"
              >
                {isVerifying ? 'Verifying Password...' : 'Unlock File'}
              </button>
            </form>
          </div>
        ) : (
          /* File Download Card */
          <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-8 shadow-xl space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
                <FileText className="w-7 h-7" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                  {fileInfo.filename}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatBytes(fileInfo.size)}
                </p>
              </div>
            </div>

            {/* Metadata Badges */}
            <div className="bg-slate-50/80 dark:bg-slate-950/60 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/80 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Shared by:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{fileInfo.owner}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>Created:</span>
                <span>{formatDate(fileInfo.created_at)}</span>
              </div>
              {fileInfo.expires_at && (
                <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                  <span>Expires:</span>
                  <span>{formatDate(fileInfo.expires_at)}</span>
                </div>
              )}
            </div>

            {/* Restriction Warning or Download Button */}
            {!fileInfo.download_allowed ? (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60 text-center space-y-1">
                <Ban className="w-5 h-5 text-rose-500 mx-auto" />
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                  Download Restricted
                </p>
                <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                  The owner has disabled downloading for this file link.
                </p>
              </div>
            ) : (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloading ? 'Downloading File...' : 'Download File'}</span>
              </button>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-4xl w-full mx-auto text-center text-[11px] text-slate-400 dark:text-slate-600 py-2">
        Protected by Private Cloud Storage &bull; End-to-End Encrypted
      </footer>
    </div>
  );
};

export default PublicSharePage;

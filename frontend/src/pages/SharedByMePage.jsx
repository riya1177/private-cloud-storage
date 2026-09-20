import React, { useState, useEffect } from 'react';
import { getSharedByMe, revokeShareLink } from '../api/share';
import { useToast } from '../context/ToastContext';
import Skeleton from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';
import { formatBytes } from '../components/ui/StorageIndicator';
import { Share2, Copy, Trash2, Calendar, Download, Lock, Globe, Users, Check, AlertCircle } from 'lucide-react';

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

const SharedByMePage = () => {
  const [shares, setShares] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showSuccess, showError } = useToast();
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchSharedFiles();
  }, []);

  const fetchSharedFiles = async () => {
    setIsLoading(true);
    try {
      const data = await getSharedByMe();
      if (Array.isArray(data)) {
        setShares(data);
      }
    } catch (err) {
      console.error('Failed to fetch shared files:', err);
      showError('Failed to load shared links.', 'Error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = (shareUrl, shareId) => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(shareId);
    showSuccess('Share link copied to clipboard.');
    setTimeout(() => setCopiedId(null), 3000);
  };

  const handleNativeShare = async (share) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: share.filename,
          text: 'Shared from Private Cloud Storage',
          url: share.share_url,
        });
        showSuccess('Shared successfully!');
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink(share.share_url, share.share_id);
        }
      }
    } else {
      handleCopyLink(share.share_url, share.share_id);
    }
  };

  const handleRevoke = async (shareId) => {
    try {
      await revokeShareLink(shareId);
      showSuccess('Share link revoked successfully.');
      fetchSharedFiles();
    } catch (err) {
      console.error('Revoke error:', err);
      showError('Failed to revoke share link.', 'Revoke Error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Shared by Me
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your active public and private share links, view download stats, or revoke access.
        </p>
      </div>

      {/* Table / List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : shares.length === 0 ? (
        <EmptyState
          title="No Shared Links Yet"
          description="Click the Share option on any file in My Files to generate a secure share link."
          icon={Share2}
        />
      ) : (
        <div className="bg-white/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-4">File Name</th>
                  <th className="p-4">Access Type</th>
                  <th className="p-4">Created</th>
                  <th className="p-4">Expires</th>
                  <th className="p-4">Downloads</th>
                  <th className="p-4">Status</th>
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
                          <Share2 className="w-4 h-4" />
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

                    {/* Access Type */}
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        {share.share_type === 'private' ? (
                          <>
                            <Users className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Private ({share.recipients?.length || 0})</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Anyone with link</span>
                          </>
                        )}
                        {share.password_protected && (
                          <Lock className="w-3 h-3 text-amber-500 ml-1" title="Password Protected" />
                        )}
                      </div>
                    </td>

                    {/* Created */}
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {formatDate(share.created_at)}
                    </td>

                    {/* Expires */}
                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {formatDate(share.expires_at)}
                    </td>

                    {/* Downloads */}
                    <td className="p-4">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {share.access_count}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                        share.status === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                          : share.status === 'Revoked'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60'
                      }`}>
                        {share.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleCopyLink(share.share_url, share.share_id)}
                          title="Copy Share Link"
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          {copiedId === share.share_id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>

                        <button
                          onClick={() => handleNativeShare(share)}
                          title="Share via App"
                          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        {share.is_active && (
                          <button
                            onClick={() => handleRevoke(share.share_id)}
                            title="Revoke Link"
                            className="p-1.5 rounded-lg text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharedByMePage;

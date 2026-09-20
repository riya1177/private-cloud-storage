import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { useToast } from '../../context/ToastContext';
import { createShareLink } from '../../api/share';
import { Share2, Copy, Lock, Calendar, Users, Globe, Check, MessageCircle, Mail } from 'lucide-react';
import axios from 'axios';

const ShareModal = ({ isOpen, onClose, file, onShareCreated }) => {
  const { showSuccess, showError } = useToast();

  const [shareType, setShareType] = useState('public'); // 'public' or 'private'
  const [expirationDays, setExpirationDays] = useState(7); // 0 (Never), 1, 7, 30
  const [allowDownload, setAllowDownload] = useState(true);
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState('');
  const [recipientEmails, setRecipientEmails] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [createdShare, setCreatedShare] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShareType('public');
      setExpirationDays(7);
      setAllowDownload(true);
      setIsPasswordProtected(false);
      setPassword('');
      setRecipientEmails('');
      setCreatedShare(null);
      setCopied(false);
    }
  }, [isOpen, file]);

  if (!file) return null;

  const handleCreateShare = async (e) => {
    e.preventDefault();

    if (isPasswordProtected && !password.trim()) {
      showError('Please enter a password or disable password protection.', 'Validation Error');
      return;
    }

    if (shareType === 'private' && !recipientEmails.trim()) {
      showError('Please specify recipient emails for private link access.', 'Validation Error');
      return;
    }

    setIsCreating(true);

    const payload = {
      share_type: shareType,
      expiration_days: Number(expirationDays),
      allow_download: allowDownload,
      password: isPasswordProtected && password.trim() ? password.trim() : null,
      recipient_emails:
        shareType === 'private' && recipientEmails.trim()
          ? recipientEmails
              .split(',')
              .map((email) => email.trim())
              .filter(Boolean)
          : null,
    };

    try {
      let data = null;

      // Primary attempt: Use imported share API function
      if (typeof createShareLink === 'function') {
        try {
          data = await createShareLink(file.id, payload);
        } catch (apiErr) {
          console.warn('createShareLink API helper failed, attempting direct axios request:', apiErr);
        }
      }

      // Fallback attempt: Direct Axios call to backend
      if (!data) {
        const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
        const res = await axios.post(`http://localhost:8000/files/${file.id}/share`, payload, {
          headers: { Authorization: `Bearer ${token}` },
        });
        data = res.data;
      }

      setCreatedShare(data);
      showSuccess('Secure share link created successfully.');

      if (onShareCreated) {
        onShareCreated(data);
      }
    } catch (err) {
      console.error('Create share error:', err);
      let msg = 'Failed to create share link.';
      if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      }
      showError(msg, 'Sharing Error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdShare?.share_url) return;
    navigator.clipboard.writeText(createdShare.share_url);
    setCopied(true);
    showSuccess('Link copied to clipboard! You can paste it in any application.');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleNativeShare = async () => {
    if (!createdShare?.share_url) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: file.filename,
          text: `Access file "${file.filename}" shared via Private Cloud Storage:`,
          url: createdShare.share_url,
        });
        showSuccess('Shared successfully!');
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleWhatsAppShare = () => {
    if (!createdShare?.share_url) return;
    const text = encodeURIComponent(`Here is the shared file "${file.filename}": ${createdShare.share_url}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleEmailShare = () => {
    if (!createdShare?.share_url) return;
    const subject = encodeURIComponent(`Shared File: ${file.filename}`);
    const body = encodeURIComponent(
      `Hello,\n\nYou can access the shared file "${file.filename}" using the link below:\n\n${createdShare.share_url}\n\nSecure Private Cloud Storage`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share File" maxWidth="max-w-lg">
      <div className="space-y-5">
        {/* File Info Header */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {file.filename}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Secure Encrypted Storage File
            </p>
          </div>
        </div>

        {/* Generated Share Output (If Created) */}
        {createdShare ? (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-semibold mb-1">
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Share link created!</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Anyone with this link can access the file according to your security permissions.
              </p>
            </div>

            {/* URL Output */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Share Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={createdShare.share_url}
                  className="flex-1 px-3 py-2 text-xs font-mono bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3.5 py-2 text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>

            {/* Application Quick Share Actions */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Share directly via application
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="py-2 px-3 text-xs font-medium bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-500/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>

                <button
                  type="button"
                  onClick={handleEmailShare}
                  className="py-2 px-3 text-xs font-medium bg-sky-600/10 hover:bg-sky-600/20 text-sky-700 dark:text-sky-400 rounded-xl border border-sky-500/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="py-2 px-3 text-xs font-medium bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 rounded-xl border border-indigo-500/30 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>More Apps</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setCreatedShare(null)}
                className="py-2 px-4 text-xs font-medium border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl transition-colors"
              >
                Create Another Link
              </button>
            </div>
          </div>
        ) : (
          /* Form for Link Creation */
          <form onSubmit={handleCreateShare} className="space-y-4">
            {/* Share Type Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Link Access
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShareType('public')}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                    shareType === 'public'
                      ? 'bg-indigo-50 dark:bg-indigo-600/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>Anyone with link</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShareType('private')}
                  className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                    shareType === 'private'
                      ? 'bg-indigo-50 dark:bg-indigo-600/15 border-indigo-300 dark:border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>Specific Users</span>
                </button>
              </div>
            </div>

            {/* Recipient Emails (if Private) */}
            {shareType === 'private' && (
              <div className="animate-fade-in">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Recipient Email(s)
                </label>
                <input
                  type="text"
                  placeholder="user@example.com, another@example.com"
                  value={recipientEmails}
                  onChange={(e) => setRecipientEmails(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Separate multiple registered email addresses with commas.
                </p>
              </div>
            )}

            {/* Expiration Dropdown */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Link Expiration</span>
              </label>
              <select
                value={expirationDays}
                onChange={(e) => setExpirationDays(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value={0}>Never Expire</option>
                <option value={1}>1 Day</option>
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            {/* Download Permission Checkbox */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="allow-download-check"
                checked={allowDownload}
                onChange={(e) => setAllowDownload(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950"
              />
              <label htmlFor="allow-download-check" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                Allow file download
              </label>
            </div>

            {/* Password Protection Toggle & Input */}
            <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-900">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  id="password-protect-check"
                  checked={isPasswordProtected}
                  onChange={(e) => setIsPasswordProtected(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                />
                <label htmlFor="password-protect-check" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Password protect link</span>
                </label>
              </div>

              {isPasswordProtected && (
                <div className="pl-6 animate-fade-in">
                  <input
                    type="password"
                    placeholder="Enter share password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3">
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
                className="px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                {isCreating ? 'Creating Link...' : 'Create Share Link'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default ShareModal;
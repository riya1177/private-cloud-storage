import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { formatBytes } from '../components/ui/StorageIndicator';
import { Shield, HardDrive, Key, LogOut, Server, KeyRound, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../api/client';
import { getTwoFactorStatus } from '../api/auth';
import ChangePasswordModal from '../components/ui/ChangePasswordModal';
import TwoFactorModal from '../components/ui/TwoFactorModal';

const SettingsPage = ({ files = [] }) => {
  const { username, logoutUser } = useAuth();
  const [isChangePassOpen, setIsChangePassOpen] = useState(false);

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);
  const [twoFactorMode, setTwoFactorMode] = useState('enable');
  const [userEmail, setUserEmail] = useState('');

  const fetch2FAStatus = useCallback(async () => {
    try {
      const data = await getTwoFactorStatus();
      setIs2FAEnabled(Boolean(data.two_factor_enabled));
      if (data.email) setUserEmail(data.email);
    } catch (err) {
      console.error('Failed to fetch 2FA status:', err);
    }
  }, []);

  useEffect(() => {
    fetch2FAStatus();
  }, [fetch2FAStatus]);

  const totalSizeBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  const totalFiles = files.length;

  return (
    <div className="max-w-4xl space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
          Settings & Account
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 transition-colors">
          System parameters, security settings, and storage metrics
        </p>
      </div>

      {/* 1. Profile Section */}
      <div className="p-6 bg-white/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm transition-colors duration-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 font-bold text-xl flex items-center justify-center border border-indigo-200 dark:border-indigo-500/30 uppercase shrink-0">
            {username ? username.charAt(0) : 'U'}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 transition-colors">
              {username || 'Authenticated User'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 transition-colors">
              {userEmail || 'Active Session • Authorized User Account'}
            </p>
          </div>
        </div>

        <button
          onClick={logoutUser}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 font-medium text-xs transition-colors shrink-0 self-start sm:self-auto shadow-sm"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 2. Security Section */}
        <div className="p-6 bg-white/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-4 shadow-sm transition-colors duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-200">
              <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h4 className="text-sm font-semibold">Security Settings</h4>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            {/* Change Password Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div>
                <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-xs">Change Password</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Update your password to keep your account secure.
                </p>
              </div>

              <button
                onClick={() => setIsChangePassOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all shadow-sm active:scale-[0.98]"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>Change Password</span>
              </button>
            </div>

            {/* Two-Step Verification Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h5 className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                    Two-Step Verification
                  </h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    Add an extra layer of security by requiring a verification code when signing in.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0 ${
                    is2FAEnabled
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                      : 'bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {is2FAEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <button
                onClick={() => {
                  setTwoFactorMode(is2FAEnabled ? 'disable' : 'enable');
                  setIs2FAModalOpen(true);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs transition-all shadow-sm active:scale-[0.98] ${
                  is2FAEnabled
                    ? 'bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{is2FAEnabled ? 'Disable 2-Step Verification' : 'Enable 2-Step Verification'}</span>
              </button>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Authentication Method</span>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-mono flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>OAuth2 Bearer Token (POST /token)</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 dark:text-slate-400 block mb-1">Backend Server Base URL</span>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono flex items-center gap-2">
                <Server className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                <span>{API_BASE_URL}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Storage Section */}
        <div className="p-6 bg-white/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl space-y-4 shadow-sm transition-colors duration-200">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-200 pb-3 border-b border-slate-200 dark:border-slate-800">
            <HardDrive className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <h4 className="text-sm font-semibold">Storage Metrics</h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Total Pool Files</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{totalFiles}</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Total Data Size</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{formatBytes(totalSizeBytes)}</span>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">Database Engine</span>
              <span className="font-mono text-slate-700 dark:text-slate-300">FastAPI + Cloud Repository</span>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePassOpen}
        onClose={() => setIsChangePassOpen(false)}
      />

      {/* Two Factor Modal */}
      <TwoFactorModal
        isOpen={is2FAModalOpen}
        onClose={() => setIs2FAModalOpen(false)}
        mode={twoFactorMode}
        username={username}
        userEmail={userEmail}
        onSuccess={fetch2FAStatus}
      />
    </div>
  );
};

export default SettingsPage;


import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Mail,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import {
  requestEnableTwoFactor,
  confirmEnableTwoFactor,
  requestDisableTwoFactor,
  confirmDisableTwoFactor,
  resendTwoFactorCode
} from '../../api/auth';

const TwoFactorModal = ({ isOpen, onClose, mode = 'enable', username = '', userEmail = '', onSuccess }) => {
  // For Enable 2FA: Step 1 = Confirm Email -> Send Code, Step 2 = Enter OTP -> Verify & Enable
  // For Disable 2FA: Step 1 = Confirm Password, Step 2 = Confirm Email -> Send Code, Step 3 = Enter OTP -> Verify & Disable
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resend cooldown timer (30 seconds)
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPassword('');
      setOtpCode('');
      setError('');
      setSuccessMsg('');
      setCooldown(0);
      const emailVal = userEmail || '';
      setTargetEmail(emailVal);
      setMaskedEmail(maskEmailStr(emailVal));
    }
  }, [isOpen, username, userEmail]);

  if (!isOpen) return null;

  const isEnableMode = mode === 'enable';

  function maskEmailStr(email) {
    if (!email || !email.includes('@')) return email || '';
    const [name, domain] = email.split('@');
    if (name.length <= 2) return `${name[0]}*@${domain}`;
    return `${name.slice(0, 2)}${'*'.repeat(name.length - 2)}@${domain}`;
  }

  // --- ENABLE 2FA: STEP 1 -> Send Code ---
  const handleEnableStep1SendCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await requestEnableTwoFactor();
      if (res.email) {
        setTargetEmail(res.email);
        setMaskedEmail(res.masked_email || maskEmailStr(res.email));
      }
      setStep(2);
      setSuccessMsg(`Verification code sent to ${res.masked_email || maskEmailStr(targetEmail)}.`);
      setCooldown(30);
    } catch (err) {
      setError(err.response?.data?.detail || 'Email verification is currently unavailable. Please configure SMTP settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- DISABLE 2FA: STEP 1 -> Password Verification ---
  const handleDisableStep1Password = (e) => {
    e.preventDefault();
    setError('');
    if (!password) {
      setError('Please enter your current password.');
      return;
    }
    setStep(2); // Move to Step 2 (Confirm Email & Send Code)
  };

  // --- DISABLE 2FA: STEP 2 -> Send Code ---
  const handleDisableStep2SendCode = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const res = await requestDisableTwoFactor(password);
      if (res.email) {
        setTargetEmail(res.email);
        setMaskedEmail(res.masked_email || maskEmailStr(res.email));
      }
      setStep(3); // Move to Step 3 (Enter OTP Code)
      setSuccessMsg(`Verification code sent to ${res.masked_email || maskEmailStr(targetEmail)}.`);
      setCooldown(30);
    } catch (err) {
      const errMsg = err.response?.data?.detail || 'Verification failed. Please check your password.';
      if (errMsg.toLowerCase().includes('password')) {
        setStep(1); // Set step back to 1 (Confirm Password) so error is shown on Step 1
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- OTP VERIFICATION (Step 2 for Enable, Step 3 for Disable) ---
  const handleOtpVerificationSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanCode = otpCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      let res;
      if (isEnableMode) {
        res = await confirmEnableTwoFactor(cleanCode);
      } else {
        res = await confirmDisableTwoFactor(cleanCode);
      }

      setSuccessMsg(res.message || (isEnableMode ? 'Two-Step Verification Enabled' : 'Two-Step Verification Disabled'));
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend code handler
  const handleResend = async () => {
    if (cooldown > 0 || isSubmitting) return;
    setError('');
    setSuccessMsg('');
    setIsSubmitting(true);
    try {
      const purpose = isEnableMode ? 'enable_2fa' : 'disable_2fa';
      await resendTwoFactorCode(username, purpose);
      setSuccessMsg(`Verification code resent to ${maskedEmail || targetEmail}.`);
      setCooldown(30);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend verification code. Please wait before retrying.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl transition-colors">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isEnableMode ? 'Set Up Two-Step Verification' : 'Disable Two-Step Verification'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEnableMode
                  ? step === 1 ? 'Step 1: Confirm Registered Email' : 'Step 2: Verify Email Code'
                  : step === 1 ? 'Step 1: Confirm Password' : step === 2 ? 'Step 2: Confirm Registered Email' : 'Step 3: Verify OTP Code'
                }
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Global Alert Banners */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {successMsg && !error && (
          <div className="flex items-start gap-2.5 p-3.5 mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FLOW A: ENABLE 2FA */}
        {/* ========================================================================= */}
        {isEnableMode && (
          <>
            {/* Enable Step 1: Confirm Email & Click "Send Verification Code" */}
            {step === 1 && (
              <form onSubmit={handleEnableStep1SendCode} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Your verification code will be sent to your registered email address.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={targetEmail}
                      disabled
                      readOnly
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-not-allowed opacity-90"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <span>Send Verification Code</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Enable Step 2: Show OTP Input & Verify */}
            {step === 2 && (
              <form onSubmit={handleOtpVerificationSubmit} className="space-y-4">
                <div className="text-center pb-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Verification Code
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Verification code sent to:
                  </p>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {maskedEmail || targetEmail}
                  </p>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value.replace(/\D/g, ''));
                        setError('');
                      }}
                      placeholder="_ _ _ _ _ _"
                      disabled={isSubmitting}
                      className="w-full text-center py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xl font-mono tracking-[0.4em] font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                      required
                    />
                  </div>
                </div>

                {/* Resend Code with 30s Countdown */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 dark:text-slate-400">Didn't receive the code?</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || isSubmitting}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.length !== 6}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify & Enable 2FA</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* FLOW B: DISABLE 2FA */}
        {/* ========================================================================= */}
        {!isEnableMode && (
          <>
            {/* Disable Step 1: Confirm Current Password */}
            {step === 1 && (
              <form onSubmit={handleDisableStep1Password} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  To disable Two-Step Verification, please confirm your current password first.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="Enter your current password"
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !password}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  >
                    <span>Continue</span>
                  </button>
                </div>
              </form>
            )}

            {/* Disable Step 2: Confirm Registered Email -> Send OTP Code */}
            {step === 2 && (
              <form onSubmit={handleDisableStep2SendCode} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  A verification code will be sent to your registered email address before disabling 2FA.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Registered Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={targetEmail}
                      disabled
                      readOnly
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-not-allowed opacity-90"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <span>Send Verification Code</span>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Disable Step 3: Enter OTP & Verify */}
            {step === 3 && (
              <form onSubmit={handleOtpVerificationSubmit} className="space-y-4">
                <div className="text-center pb-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Verification Code
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Verification code sent to:
                  </p>
                  <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {maskedEmail || targetEmail}
                  </p>
                </div>

                <div>
                  <div className="relative">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e.target.value.replace(/\D/g, ''));
                        setError('');
                      }}
                      placeholder="_ _ _ _ _ _"
                      disabled={isSubmitting}
                      className="w-full text-center py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xl font-mono tracking-[0.4em] font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                      required
                    />
                  </div>
                </div>

                {/* Resend Code with 30s Countdown */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-500 dark:text-slate-400">Didn't receive the code?</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || isSubmitting}
                    className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back</span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || otpCode.length !== 6}
                    className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Disable Two-Step Verification</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TwoFactorModal;

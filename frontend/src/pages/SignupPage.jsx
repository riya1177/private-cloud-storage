import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import {
  Cloud,
  Lock,
  User,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  AlertCircle,
  Sun,
  Moon,
  ArrowLeft,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { requestSignupOtp, verifySignupOtp, createSignupAccount } from '../api/auth';
import GoogleSignInButton from '../components/auth/GoogleSignInButton';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

const SignupPage = () => {
  // Steps: 1 ('user_info') | 2 ('verify_otp') | 3 ('create_password') | 4 ('success')
  const [step, setStep] = useState(1);

  // Form Inputs
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 30s Cooldown for OTP resend
  const [cooldown, setCooldown] = useState(0);

  const { isDark, toggleTheme } = useTheme();
  const { completeTwoFactorLogin } = useAuth();
  const navigate = useNavigate();

  // Google Sign-Up Handler
  const handleGoogleSuccess = async (credential) => {
    setError('');
    setIsSubmitting(true);
    try {
      const response = await client.post('/auth/google/callback', { credential });
      if (response.data && response.data.access_token) {
        completeTwoFactorLogin(response.data.username || 'Google User', response.data.access_token);
        navigate('/dashboard');
      } else {
        setError('Google Sign-Up succeeded, but backend did not return a session token.');
      }
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        setError('Google Sign-Up credential received. The backend authentication endpoint (/auth/google/callback) is required to issue a valid application session token.');
      } else {
        setError(err.response?.data?.detail || err.message || 'Google authentication failed on server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cooldown ticker
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // STEP 1: Request Signup OTP
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanName = username.trim();
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length < 3) {
      setError('Please enter a valid name or username (at least 3 characters).');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await requestSignupOtp(cleanName, cleanEmail);
      if (data.status === 'success') {
        setMaskedEmail(data.masked_email || cleanEmail);
        setStep(2);
        setCooldown(30);
      } else {
        setError(data.message || 'Failed to send verification code.');
      }
    } catch (err) {
      console.error('Signup OTP request error:', err);
      setError(err.response?.data?.detail || 'Failed to send verification code. Please check details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: Verify Email OTP
  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanCode = otpInput.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await verifySignupOtp(email.trim(), cleanCode);
      if (data.verification_token) {
        setVerificationToken(data.verification_token);
        setStep(3);
      } else {
        setError('Verification failed. Invalid code.');
      }
    } catch (err) {
      console.error('Signup OTP verify error:', err);
      setError(err.response?.data?.detail || 'Invalid or expired verification code.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 2: Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || isSubmitting) return;
    setError('');
    setIsSubmitting(true);
    try {
      await requestSignupOtp(username.trim(), email.trim());
      setCooldown(30);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // STEP 3: Create Password & Finalize Account Creation
  const handleStep3Submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter passwords.');
      return;
    }

    setIsSubmitting(true);
    try {
      const data = await createSignupAccount(
        username.trim(),
        email.trim(),
        verificationToken,
        password
      );

      if (data.status === 'success') {
        setStep(4);
        setSuccessMsg('Account created successfully. Please log in.');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.message || 'Failed to create account.');
      }
    } catch (err) {
      console.error('Signup account creation error:', err);
      setError(err.response?.data?.detail || 'Account creation failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans transition-colors duration-200">
      {/* Top right Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm transition-all active:scale-95"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>
      </div>

      {/* Background subtle glow effect */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Signup Card */}
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-8 shadow-xl dark:shadow-2xl backdrop-blur-md z-10 animate-slide-up transition-colors duration-200">
        {/* Logo & App Info */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3.5 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3">
            <Cloud className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight transition-colors">
            Private Cloud Storage
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed transition-colors">
            Final Year Project • Secure & Encrypted Document Pool
          </p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs mb-5 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {/* Global Success Banner */}
        {successMsg && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs mb-5 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 dark:text-emerald-400 mt-0.5" />
            <div className="flex-1 font-medium">{successMsg}</div>
          </div>
        )}

        {/* STEP 1: USER INFORMATION */}
        {step === 1 && (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="text-center pb-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Create Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Step 1 of 3 — Enter your details to get started
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 transition-colors">
                Name / Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your name"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 transition-colors">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your email"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-150 shadow-lg shadow-indigo-600/25 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending code...</span>
                </>
              ) : (
                <span>Send Verification Code</span>
              )}
            </button>

            {/* Separator */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="border-t border-slate-200 dark:border-slate-800 w-full" />
              <span className="bg-white/90 dark:bg-slate-900/90 px-3 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase absolute">
                OR
              </span>
            </div>

            {/* Google Sign-Up Option */}
            <GoogleSignInButton
              text="Sign up with Google"
              onGoogleSuccess={handleGoogleSuccess}
              onGoogleError={(msg) => setError(msg)}
              disabled={isSubmitting}
            />

            <div className="mt-4 text-center text-xs text-slate-600 dark:text-slate-400">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline transition-colors"
              >
                Log In
              </Link>
            </div>
          </form>
        )}

        {/* STEP 2: VERIFY EMAIL USING OTP */}
        {step === 2 && (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div className="text-center pb-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Verify Your Email
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                We sent a verification code to:
              </p>
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                {maskedEmail}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 text-center transition-colors">
                Verification Code
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, ''));
                    setError('');
                  }}
                  placeholder="_ _ _ _ _ _"
                  disabled={isSubmitting}
                  className="w-full text-center py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xl font-mono tracking-[0.4em] font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* Resend code */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 dark:text-slate-400">Didn't receive code?</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0 || isSubmitting}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend Code'}
              </button>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || otpInput.length !== 6}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify Email</span>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError('');
                setOtpInput('');
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </button>
          </form>
        )}

        {/* STEP 3: CREATE PASSWORD */}
        {step === 3 && (
          <form onSubmit={handleStep3Submit} className="space-y-4">
            <div className="text-center pb-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Create Your Password
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Step 3 of 3 — Secure your account
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 transition-colors">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Create password"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 transition-colors">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Confirm password"
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all duration-150 shadow-lg shadow-indigo-600/25 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>
        )}

        {/* STEP 4: SUCCESS REDIRECT */}
        {step === 4 && (
          <div className="py-6 text-center space-y-3">
            <div className="inline-flex p-3 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Account Created Successfully!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Redirecting you to the login page...
            </p>
          </div>
        )}

        {/* Security footnote */}
        <div className="mt-6 pt-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 transition-colors">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>OAuth2 Bearer Token & Email Verification</span>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;

import React, { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Official Google Logo SVG with official brand colors.
 */
const GoogleLogo = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.2 0 10.04 0 12s.46 3.8 1.27 5.42l4.01-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

const GoogleSignInButton = ({
  text = "Continue with Google",
  onGoogleSuccess,
  onGoogleError,
  disabled = false
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const hiddenGsiButtonRef = useRef(null);

  // Dynamically load Google Identity Services SDK script
  useEffect(() => {
    if (!clientId) return;

    const loadGsiScript = () => {
      if (document.getElementById('google-gsi-script')) {
        initializeGsi();
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeGsi();
      };
      script.onerror = () => {
        console.error('Failed to load Google Identity Services SDK.');
      };
      document.head.appendChild(script);
    };

    const initializeGsi = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (hiddenGsiButtonRef.current) {
            window.google.accounts.id.renderButton(hiddenGsiButtonRef.current, {
              theme: 'outline',
              size: 'large',
              width: '100%',
            });
          }
        } catch (e) {
          console.error('Error initializing Google Identity Services:', e);
        }
      }
    };

    loadGsiScript();
  }, [clientId]);

  const handleCredentialResponse = async (response) => {
    setIsLoading(true);
    try {
      if (!response.credential) {
        throw new Error('No credential received from Google Sign-In.');
      }
      if (onGoogleSuccess) {
        await onGoogleSuccess(response.credential);
      }
    } catch (err) {
      console.error('Google Sign-In Error:', err);
      if (onGoogleError) {
        onGoogleError(err.message || 'Google Sign-In failed.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleButtonClick = () => {
    if (!clientId) {
      if (onGoogleError) {
        onGoogleError('Google OAuth Client ID is missing. Set VITE_GOOGLE_CLIENT_ID in your frontend .env file.');
      } else {
        alert('Google OAuth Client ID is missing. Set VITE_GOOGLE_CLIENT_ID in your frontend .env file.');
      }
      return;
    }

    if (window.google?.accounts?.id) {
      setIsLoading(true);
      // Trigger official GSI prompt or click rendered hidden button
      if (hiddenGsiButtonRef.current && hiddenGsiButtonRef.current.querySelector('div[role="button"]')) {
        const btn = hiddenGsiButtonRef.current.querySelector('div[role="button"]');
        btn.click();
      } else {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setIsLoading(false);
          }
        });
      }
    } else {
      if (onGoogleError) {
        onGoogleError('Google Identity Services SDK is not loaded yet. Please try again.');
      }
    }
  };

  return (
    <div className="w-full relative">
      {/* Hidden container for official GSI rendered button if required by GIS */}
      <div ref={hiddenGsiButtonRef} className="hidden" />

      <button
        type="button"
        onClick={handleButtonClick}
        disabled={disabled || isLoading}
        className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/80 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all duration-150 shadow-sm active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-3"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span>Connecting to Google...</span>
          </>
        ) : (
          <>
            <GoogleLogo className="w-4 h-4 shrink-0" />
            <span>{text}</span>
          </>
        )}
      </button>
    </div>
  );
};

export default GoogleSignInButton;

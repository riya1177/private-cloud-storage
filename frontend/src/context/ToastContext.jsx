import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ type = 'info', message, title, duration = 3500 }) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, message, title }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const showSuccess = useCallback(
    (message, title = 'Success') => {
      addToast({ type: 'success', message, title });
    },
    [addToast]
  );

  const showError = useCallback(
    (message, title = 'Error') => {
      addToast({ type: 'error', message, title, duration: 4500 });
    },
    [addToast]
  );

  const showInfo = useCallback(
    (message, title = 'Information') => {
      addToast({ type: 'info', message, title });
    },
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo, addToast }}>
      {children}
      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl transition-all duration-200 animate-slide-up backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-white/95 dark:bg-slate-900/95 border-emerald-500/40 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                : toast.type === 'error'
                ? 'bg-white/95 dark:bg-slate-900/95 border-rose-500/40 dark:border-rose-500/30 text-rose-900 dark:text-rose-200'
                : 'bg-white/95 dark:bg-slate-900/95 border-indigo-500/40 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
            </div>
            <div className="flex-1 min-w-0">
              {toast.title && <h4 className="text-xs font-semibold uppercase tracking-wider opacity-90">{toast.title}</h4>}
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 leading-snug">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

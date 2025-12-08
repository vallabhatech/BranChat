import { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';

interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastQueue: ToastMessage[] = [];
let setToasts: ((toasts: ToastMessage[]) => void) | null = null;

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const id = Math.random().toString(36).substr(2, 9);
  const toast: ToastMessage = { id, message, type };
  
  toastQueue.push(toast);
  if (setToasts) {
    setToasts([...toastQueue]);
  }

  // Auto remove after 3 seconds
  setTimeout(() => {
    toastQueue = toastQueue.filter(t => t.id !== id);
    if (setToasts) {
      setToasts([...toastQueue]);
    }
  }, 3000);
};

export function Toast() {
  const [toasts, setToastsState] = useState<ToastMessage[]>([]);

  useEffect(() => {
    setToasts = setToastsState;
    return () => {
      setToasts = null;
    };
  }, []);

  const removeToast = (id: string) => {
    toastQueue = toastQueue.filter(t => t.id !== id);
    setToastsState([...toastQueue]);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-bottom-2 ${
            toast.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
          }`}
        >
          <div className={`flex-shrink-0 ${
            toast.type === 'success'
              ? 'text-green-600 dark:text-green-400'
              : toast.type === 'error'
              ? 'text-red-600 dark:text-red-400'
              : 'text-blue-600 dark:text-blue-400'
          }`}>
            <Check size={16} />
          </div>
          
          <div className={`flex-1 text-sm font-medium ${
            toast.type === 'success'
              ? 'text-green-900 dark:text-green-200'
              : toast.type === 'error'
              ? 'text-red-900 dark:text-red-200'
              : 'text-blue-900 dark:text-blue-200'
          }`}>
            {toast.message}
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className={`flex-shrink-0 p-1 rounded hover:bg-opacity-20 transition-colors ${
              toast.type === 'success'
                ? 'text-green-600 dark:text-green-400 hover:bg-green-600'
                : toast.type === 'error'
                ? 'text-red-600 dark:text-red-400 hover:bg-red-600'
                : 'text-blue-600 dark:text-blue-400 hover:bg-blue-600'
            }`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // 1. Theme state manager (dark mode baseline)
  const [darkMode, setDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  // 2. Tenancy states
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [workspaceSettings, setWorkspaceSettings] = useState(null); // full settings object
  const [toasts, setToasts] = useState([]);

  // 3. Sync theme class on HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // 4. Initial load user session profile
  useEffect(() => {
    const loadSession = async () => {
      try {
        const response = await api.get('/auth/me');
        setUser(response.data);
        setActiveWorkspace(response.data.workspaces);
        setWorkspaceSettings(response.data.workspaces?.settings || {});
      } catch (err) {
        console.error('Session profile load warning:', err.message);
        // Dev offline fallback trigger
        setUser({
          id: 'dev-agent-id',
          name: 'Alice Agent Dev',
          email: 'agent@alice.ai',
          role: 'admin',
          workspace_id: 'wp-mock-123'
        });
        setActiveWorkspace({ name: 'Alice HQ Space', slug: 'alice-hq' });
      } finally {
        setLoading(false);
      }
    };
    loadSession();
  }, []);

  const [confirmConfig, setConfirmConfig] = useState(null);

  // 5. Visual Notification helper toast alerts
  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // 6. Global custom Confirmation Dialog modal
  const showConfirm = (title, message, onConfirm, onCancel = null) => {
    setConfirmConfig({
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig(null);
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setConfirmConfig(null);
      }
    });
  };

  return (
    <AppContext.Provider value={{
      darkMode,
      setDarkMode,
      user,
      setUser,
      loading,
      activeWorkspace,
      setActiveWorkspace,
      workspaceSettings,
      setWorkspaceSettings,
      toasts,
      showToast,
      removeToast,
      showConfirm
    }}>
      {children}

      {/* Dynamic Visual Notification Banners container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between min-w-[280px] max-w-sm px-4 py-3 rounded-xl shadow-glass border animate-slide-up ${
              toast.type === 'error'
                ? 'bg-red-950/80 border-red-800 text-red-200'
                : toast.type === 'warning'
                ? 'bg-amber-950/80 border-amber-800 text-amber-200'
                : 'bg-indigo-950/80 border-indigo-800 text-indigo-200'
            }`}
          >
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="ml-3 text-white/60 hover:text-white cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Custom Confirmation dialog modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel p-6 max-w-sm w-full flex flex-col gap-5 animate-scale-in border border-white/10 text-white shadow-2xl relative bg-[#0d0e16]/90">
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-extrabold tracking-wide text-white">{confirmConfig.title}</h3>
              <p className="text-xs text-white/70 leading-relaxed">{confirmConfig.message}</p>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-1">
              <button
                onClick={confirmConfig.onCancel}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 active:scale-95 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={confirmConfig.onConfirm}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-red-600 hover:bg-red-700 text-white active:scale-95 transition cursor-pointer shadow-lg shadow-red-600/15"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

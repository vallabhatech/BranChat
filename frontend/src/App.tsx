import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { BranchatLayout } from './components/Layout/BranchatLayout';
import { Toast } from './components/Toast';

function AppContent() {
  const { user, loading, createGuestSession } = useAuth();
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  // Auto-login as guest if no user is logged in
  useEffect(() => {
    if (!loading && !user && !autoLoginAttempted) {
      setAutoLoginAttempted(true);
      createGuestSession();
    }
  }, [loading, user, autoLoginAttempted, createGuestSession]);

  // Reset conversation state and refresh when user changes (login/logout)
  useEffect(() => {
    if (user) {
      console.log('👤 User logged in/changed, refreshing conversations for:', user.id);
      // Clear current conversation when user changes
      setCurrentConversationId(undefined);
      // Trigger refresh to load conversations for the new user
      setRefreshKey(prev => prev + 1);
    }
  }, [user?.id]); // Detect user login or user change

  // Handle logout specifically
  useEffect(() => {
    if (!loading && !user) {
      console.log('👤 User logged out, clearing conversation state');
      // Clear conversation state on logout
      setCurrentConversationId(undefined);
      // Trigger refresh to clear conversations
      setRefreshKey(prev => prev + 1);
    }
  }, [user, loading]); // Detect user logout

  if (loading || (!user && !autoLoginAttempted)) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1a1a1a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-[#1a73e8]"></div>
      </div>
    );
  }

  return (
    <>
      <BranchatLayout
        currentConversationId={currentConversationId}
        onConversationChange={(id) => {
          console.log('🎯 App: Setting conversation ID:', id);
          setCurrentConversationId(id);
          setRefreshKey(prev => prev + 1);
        }}
        refreshKey={refreshKey}
      />
      <Toast />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

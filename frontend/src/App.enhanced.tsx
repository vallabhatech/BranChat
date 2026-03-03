/**
 * Enhanced App Component
 * 
 * Refactored with context providers and improved error handling
 */

import { useState, useEffect, Suspense } from 'react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ChatProvider } from './contexts/ChatContext';
import { AIProviderProvider } from './contexts/AIProviderContext';
import { BranchatLayout } from './components/Layout/BranchatLayout';
import { Toast } from './components/toast';
import { FullPageLoading } from './components/ui/LoadingSpinner';

function AppContent() {
  const { user, loading, createGuestSession } = useAuth();
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);

  // Auto-login as guest if no user is logged in
  useEffect(() => {
    if (!loading && !user && !autoLoginAttempted) {
      setAutoLoginAttempted(true);
      createGuestSession().catch(error => {
        console.error('Failed to create guest session:', error);
      });
    }
  }, [loading, user, autoLoginAttempted, createGuestSession]);

  if (loading || (!user && !autoLoginAttempted)) {
    return <FullPageLoading text="Initializing..." />;
  }

  return (
    <BranchatLayout />
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <AIProviderProvider>
            <ChatProvider>
              <Suspense fallback={<FullPageLoading text="Loading chat..." />}>
                <AppContent />
              </Suspense>
            </ChatProvider>
          </AIProviderProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

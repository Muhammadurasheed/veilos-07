
import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/optimized/AuthContextRefactored';
import { SmartRouter } from '@/components/routing/SmartRouter';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ui/error-boundary';

import FlagshipLanding from '@/pages/FlagshipLanding';
import Dashboard from '@/pages/Dashboard';
import Auth from '@/pages/Auth';
import SanctuaryJoinViaInvite from '@/components/sanctuary/SanctuaryJoinViaInvite';
import Feed from '@/pages/Feed';
import BeaconsList from '@/pages/BeaconsList';
import ExpertProfile from '@/pages/ExpertProfile';
import ExpertRegistration from '@/pages/ExpertRegistration';
import ExpertDashboard from '@/pages/ExpertDashboard';
import Chat from '@/pages/Chat';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';
import SessionHub from '@/pages/SessionHub';
import NotFound from '@/pages/NotFound';
import AdminPanel from '@/pages/AdminPanel';
import BookSession from '@/pages/BookSession';
import Sanctuary from '@/pages/Sanctuary';
import SanctuaryRecover from '@/pages/SanctuaryRecover';
import SanctuaryInbox from '@/components/sanctuary/SanctuaryInbox';
import SanctuaryInboxPage from '@/pages/SanctuaryInbox';
import { SanctuaryHostDashboard } from '@/components/sanctuary/SanctuaryHostDashboard';
import MySanctuariesPage from '@/pages/MySanctuaries';
import SanctuarySubmit from '@/pages/SanctuarySubmit';
import EnhancedSanctuary from '@/pages/EnhancedSanctuary';
import EnhancedLiveSanctuary from '@/pages/EnhancedLiveSanctuary';
import Phase4Test from '@/pages/Phase4Test';
import FollowedExperts from '@/pages/FollowedExperts';
import FlagshipSanctuary from '@/pages/FlagshipSanctuary';
import FlagshipSanctuaryCreate from '@/pages/FlagshipSanctuaryCreate';
import { SessionProvider } from '@/contexts/SessionContext';
import { ProtectedRoute } from '@/components/routing/ProtectedRoute';

import './App.css';

const AuthErrorFallback = ({ error }: { error: Error }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-primary/5">
    <div className="text-center space-y-4">
      <h2 className="text-2xl font-bold text-foreground">Authentication Error</h2>
      <p className="text-muted-foreground">Unable to load authentication. Please refresh the page.</p>
    </div>
  </div>
);

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  // Initialize i18n and other global services
  useEffect(() => {
    // Set up any additional initialization here
    document.title = 'Veilo - Anonymous Support & Guidance';
  }, []);

  return (
    <ErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ErrorBoundary fallback={AuthErrorFallback}>
                <SmartRouter>
              <Routes>
                <Route path="/" element={
                  <ProtectedRoute requireAuth={false}>
                    <FlagshipLanding />
                  </ProtectedRoute>
                } />
                <Route path="/auth" element={
                  <ProtectedRoute requireAuth={false}>
                    <Auth />
                  </ProtectedRoute>
                } />
                <Route path="/dashboard" element={
                  <ProtectedRoute requireAuth={true}>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/sanctuary/join/:inviteCode" element={<SanctuaryJoinViaInvite />} />
                        <Route path="/feed" element={<Feed />} />
                        <Route path="/beacons" element={<BeaconsList />} />
                        <Route path="/beacons/:expertId" element={
                          <ProtectedRoute requireAuth={true}>
                            <ExpertProfile />
                          </ProtectedRoute>
                        } />
                        <Route path="/followed-experts" element={
                          <ProtectedRoute requireAuth={true}>
                            <FollowedExperts />
                          </ProtectedRoute>
                        } />
                        <Route path="/expert/:expertId" element={
                          <ProtectedRoute requireAuth={true}>
                            <ExpertProfile />
                          </ProtectedRoute>
                        } />
                        <Route path="/sessions/book/:expertId" element={
                          <ProtectedRoute requireAuth={true}>
                            <BookSession />
                          </ProtectedRoute>
                        } />
                        <Route path="/call/:expertId/:type" element={
                          <ProtectedRoute requireAuth={true}>
                            <Chat />
                          </ProtectedRoute>
                        } />
                        <Route path="/chat/:sessionId?" element={
                          <ProtectedRoute requireAuth={true}>
                            <Chat />
                          </ProtectedRoute>
                        } />
                        <Route path="/sessions" element={
                          <ProtectedRoute requireAuth={true}>
                            <SessionHub />
                          </ProtectedRoute>
                        } />
                        <Route path="/profile" element={
                          <ProtectedRoute requireAuth={true}>
                            <Profile />
                          </ProtectedRoute>
                        } />
                        <Route path="/settings" element={
                          <ProtectedRoute requireAuth={true}>
                            <Settings />
                          </ProtectedRoute>
                        } />
                        <Route path="/register-expert" element={<ExpertRegistration />} />
                        <Route path="/expert-dashboard" element={<ExpertDashboard />} />
                        <Route path="/admin/*" element={<AdminPanel />} />
                        <Route path="/sanctuary" element={<Sanctuary />} />
                        <Route path="/sanctuary/recover" element={<SanctuaryRecover />} />
                        <Route path="/sanctuary-inbox/:id" element={<SanctuaryInbox />} />
                        <Route path="/sanctuary-host/:id" element={<SanctuaryHostDashboard />} />
        <Route path="/sanctuary/submit/:sessionId" element={<SanctuarySubmit />} />
        <Route path="/sanctuary/inbox/:sessionId" element={<SanctuaryInboxPage />} />
        <Route path="/sanctuary/recover/:sessionId" element={<SanctuaryRecover />} />
        <Route path="/sanctuary/live/:sessionId" element={<EnhancedLiveSanctuary />} />
        <Route path="/my-sanctuaries" element={
          <ProtectedRoute requireAuth={true}>
            <MySanctuariesPage />
          </ProtectedRoute>
        } />
                        <Route path="/sanctuary/:sessionId" element={<EnhancedSanctuary />} />
                        <Route path="/flagship-sanctuary" element={<FlagshipSanctuaryCreate />} />
                        <Route path="/flagship-sanctuary/:sessionId" element={<FlagshipSanctuary />} />
                        <Route path="/flagship-sanctuary/:sessionId/breakout/:roomId" element={
                          <ProtectedRoute requireAuth={true}>
                            <div>Breakout Room Component</div>
                          </ProtectedRoute>
                        } />
                        <Route path="/phase4-test" element={<Phase4Test />} />
                        <Route path="*" element={<NotFound />} />
              </Routes>
              </SmartRouter>
              <Toaster />
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </ErrorBoundary>
  );
}

export default App;

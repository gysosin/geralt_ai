import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './components/Auth';
import { AuthCallback } from './src/pages/AuthCallback';
import { useAuthStore } from './src/store';
import { ProtectedRoute, PublicRoute } from './src/components/auth';

const AgentPlatform = lazy(() => import('./components/AgentPlatform'));
const Analytics = lazy(() => import('./components/Analytics'));
const BotDetail = lazy(() => import('./components/BotDetail'));
const Bots = lazy(() => import('./components/Bots'));
const ChatInterface = lazy(() => import('./components/ChatInterface'));
const CollectionDetail = lazy(() => import('./components/CollectionDetail'));
const Collections = lazy(() => import('./components/Collections'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const DocumentReviewQueue = lazy(() => import('./src/pages/DocumentReviewQueue'));
const History = lazy(() => import('./components/History'));
const HistoryDetail = lazy(() => import('./components/HistoryDetail'));
const GlobalSearch = lazy(() => import('./src/pages/GlobalSearch'));
const NotificationProvider = lazy(() => import('./src/components/NotificationProvider'));
const Settings = lazy(() => import('./components/Settings'));

const routeFallback = (
  <div className="flex h-full items-center justify-center text-sm text-gray-500">
    Loading workspace
  </div>
);

const App: React.FC = () => {
  const { isAuthenticated, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Auth />
            </PublicRoute>
          }
        />

        <Route
          path="/signup"
          element={
            <PublicRoute>
              <Auth initialMode="signup" />
            </PublicRoute>
          }
        />

        <Route
          path="/forgot-password"
          element={
            <PublicRoute>
              <Auth initialMode="forgot-password" />
            </PublicRoute>
          }
        />

        <Route
          path="/auth/callback"
          element={<AuthCallback />}
        />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Suspense fallback={routeFallback}>
                <NotificationProvider>
                  <Layout onLogout={handleLogout}>
                    <Suspense fallback={routeFallback}>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="chat/:conversationId?" element={<ChatInterface />} />

                        <Route path="bots" element={<Bots />} />
                        <Route path="bots/:id" element={<BotDetail />} />
                        <Route path="agent-platform" element={<AgentPlatform />} />

                        <Route path="collections" element={<Collections />} />
                        <Route path="collections/:id" element={<CollectionDetail />} />
                        <Route path="documents/review" element={<DocumentReviewQueue />} />

                        <Route path="analytics" element={<Analytics />} />
                        <Route path="search" element={<GlobalSearch />} />

                        <Route path="history" element={<History />} />
                        <Route path="history/:id" element={<HistoryDetail />} />

                        <Route path="settings" element={<Settings />} />
                        <Route path="*" element={<div className="flex items-center justify-center h-full text-gray-500">Page not found</div>} />
                      </Routes>
                    </Suspense>
                  </Layout>
                </NotificationProvider>
              </Suspense>
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
};

export default App;

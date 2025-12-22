import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ChatInterface from './components/ChatInterface';
import Bots from './components/Bots';
import BotDetail from './components/BotDetail';
import Collections from './components/Collections';
import CollectionDetail from './components/CollectionDetail';
import Analytics from './components/Analytics';
import History from './components/History';
import HistoryDetail from './components/HistoryDetail';
import Settings from './components/Settings';
import Auth from './components/Auth';
import { AuthCallback } from './src/pages/AuthCallback';
import { useAuthStore } from './src/store';
import { ProtectedRoute, PublicRoute } from './src/components/auth';

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
              <Layout onLogout={handleLogout}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="chat/:conversationId?" element={<ChatInterface />} />

                  <Route path="bots" element={<Bots />} />
                  <Route path="bots/:id" element={<BotDetail />} />

                  <Route path="collections" element={<Collections />} />
                  <Route path="collections/:id" element={<CollectionDetail />} />

                  <Route path="analytics" element={<Analytics />} />

                  <Route path="history" element={<History />} />
                  <Route path="history/:id" element={<HistoryDetail />} />

                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<div className="flex items-center justify-center h-full text-gray-500">Page not found</div>} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
};

export default App;
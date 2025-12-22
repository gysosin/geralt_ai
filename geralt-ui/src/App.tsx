import { useState, useMemo } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MainLayout } from '@/components/layout'
import { ProtectedRoute, PublicRoute } from '@/components/auth'
import { CommandPalette } from '@/components/command-palette'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import {
  LoginPage,
  RegisterPage,
  DashboardPage,
  ChatPage,
  HistoryPage,
  ProfilePage,
  SettingsPage,
  AuthCallbackPage,
  BotsPage,
  CollectionsPage,
  CollectionDetailPage,
  BotConversationsPage,
  QuizzesPage,
  QuizTakePage,
  QuizResultsPage,
  TemplatesPage,
  AnalyticsPage,
} from '@/pages'

// Separate component to use hooks that require Router context
function AppContent() {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const navigate = useNavigate()

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    { key: 'k', meta: true, handler: () => setCommandPaletteOpen(true) },
    { key: 'k', ctrl: true, handler: () => setCommandPaletteOpen(true) },
    { key: 'n', meta: true, handler: () => navigate('/chat') },
    { key: 'n', ctrl: true, handler: () => navigate('/chat') },
  ], [navigate])

  useKeyboardShortcuts(shortcuts)

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Protected Routes with Layout */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:conversationId" element={<ChatPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/bots" element={<BotsPage />} />
          <Route path="/bots/:token/conversations" element={<BotConversationsPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/collections/:id" element={<CollectionDetailPage />} />
          <Route path="/quizzes" element={<QuizzesPage />} />
          <Route path="/quizzes/:quizId/take" element={<QuizTakePage />} />
          <Route path="/quizzes/:quizId/results" element={<QuizResultsPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Route>

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Command Palette */}
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
    </>
  )
}

function App() {
  return (
    <TooltipProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  )
}

export default App

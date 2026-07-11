import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { Layout } from './components/Layout';
import { AuthView } from './views/AuthView';
import { IngestionView } from './views/IngestionView';
import { DashboardView } from './views/DashboardView';
import { PublicView } from './views/PublicView';
import { SettingsView } from './views/SettingsView';
import { WorkspaceHealthView } from './views/WorkspaceHealthView';
import { InsightsView } from './views/InsightsView';
import { MarketplaceView } from './views/MarketplaceView';
import { LearningHubView } from './views/LearningHubView';
import { IntegrationsView } from './views/IntegrationsView';
import { UserGuide } from './views/UserGuide';

// Inline Protected View router wrapper
const Protected = ({ children }: { children: React.ReactNode }) => {
  const { token, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-deep flex items-center justify-center">
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-t-brand-teal border-brand-border/40"></div>
      </div>
    );
  }
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <Routes>
            {/* Public Views */}
            <Route path="/login" element={<AuthView />} />
            <Route path="/share/:uuid" element={<PublicView />} />

            {/* Protected Views */}
            <Route
              path="/dashboard"
              element={
                <Protected>
                  <DashboardView />
                </Protected>
              }
            />
            <Route
              path="/ingestion"
              element={
                <Protected>
                  <IngestionView />
                </Protected>
              }
            />
            <Route
              path="/settings"
              element={
                <Protected>
                  <SettingsView />
                </Protected>
              }
            />
            <Route
              path="/health"
              element={
                <Protected>
                  <WorkspaceHealthView />
                </Protected>
              }
            />
            <Route
              path="/insights"
              element={
                <Protected>
                  <InsightsView />
                </Protected>
              }
            />
            <Route
              path="/marketplace"
              element={
                <Protected>
                  <MarketplaceView />
                </Protected>
              }
            />
            <Route
              path="/academy"
              element={
                <Protected>
                  <LearningHubView />
                </Protected>
              }
            />
            <Route
              path="/integrations"
              element={
                <Protected>
                  <IntegrationsView />
                </Protected>
              }
            />

            <Route
              path="/guide"
              element={
                <Protected>
                  <UserGuide />
                </Protected>
              }
            />

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;

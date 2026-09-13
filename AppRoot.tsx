import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute, FullPageLoader } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LandingPage } from "./pages/LandingPage";
import { AuthPage } from "./pages/AuthPage";

// Route-level code splitting: the landing/auth pages are the first thing a
// visitor downloads, so they stay in the main chunk. Everything behind the
// auth gate (the actual studio tools) loads on demand instead of bloating
// that first paint with code most visitors never reach.
const StudioPage = lazy(() => import("./pages/StudioPage").then((m) => ({ default: m.StudioPage })));
const ProStudioPage = lazy(() => import("./pages/ProStudioPage").then((m) => ({ default: m.ProStudioPage })));
const GalleryPage = lazy(() => import("./pages/GalleryPage").then((m) => ({ default: m.GalleryPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const AdminPage = lazy(() => import("./pages/AdminPage").then((m) => ({ default: m.AdminPage })));

/** Redirects already-authenticated users away from the auth pages. */
const AuthOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to="/app" replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => (
  <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route
      path="/login"
      element={
        <AuthOnly>
          <AuthPage mode="login" />
        </AuthOnly>
      }
    />
    <Route
      path="/signup"
      element={
        <AuthOnly>
          <AuthPage mode="signup" />
        </AuthOnly>
      }
    />

    <Route
      element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }
    >
      <Route
        path="/app"
        element={
          <Suspense fallback={<FullPageLoader label="Loading Studio…" />}>
            <StudioPage />
          </Suspense>
        }
      />
      <Route
        path="/pro"
        element={
          <Suspense fallback={<FullPageLoader label="Loading Pro Studio…" />}>
            <ProStudioPage />
          </Suspense>
        }
      />
      <Route
        path="/gallery"
        element={
          <Suspense fallback={<FullPageLoader label="Loading Gallery…" />}>
            <GalleryPage />
          </Suspense>
        }
      />
      <Route
        path="/settings"
        element={
          <Suspense fallback={<FullPageLoader label="Loading Settings…" />}>
            <SettingsPage />
          </Suspense>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <Suspense fallback={<FullPageLoader label="Loading Admin…" />}>
              <AdminPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
    </Route>

    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </ErrorBoundary>
);

export default App;

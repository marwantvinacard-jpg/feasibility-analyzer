import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

/** Full-page spinner while auth state resolves. */
export const FullPageLoader: React.FC<{ label?: string }> = ({ label }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
    <Loader2 className="animate-spin text-gold-500" size={32} />
    {label && <p className="mt-4 text-sm">{label}</p>}
  </div>
);

/**
 * Guards routes that require an authenticated + approved account.
 * - not signed in  -> /login
 * - signed in      -> children (Studio itself handles the pending/disabled state
 *                      so approved-only tools stay usable while pending users
 *                      still see an in-app "awaiting approval" screen)
 * When `adminOnly` is set, non-admins are redirected to /app.
 */
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  adminOnly?: boolean;
}> = ({ children, adminOnly }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader label="Loading your studio…" />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && profile?.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

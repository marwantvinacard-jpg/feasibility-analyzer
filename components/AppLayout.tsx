import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Logo } from "./Logo";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  Images,
  Settings,
  ShieldCheck,
  LogOut,
  LayoutDashboard,
} from "lucide-react";

const navBase =
  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors";

export const AppLayout: React.FC = () => {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `${navBase} ${
      isActive
        ? "bg-charcoal text-white shadow"
        : "text-gray-500 hover:text-charcoal hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gray-50 text-charcoal font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <Logo variant="header" size="sm" />

          <nav aria-label="Primary" className="hidden md:flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-full p-1">
            <NavLink to="/app" className={linkClass}>
              <Sparkles size={16} /> Studio
            </NavLink>
            <NavLink to="/pro" className={linkClass}>
              <LayoutDashboard size={16} /> Pro Studio
            </NavLink>
            <NavLink to="/gallery" className={linkClass}>
              <Images size={16} /> Gallery
            </NavLink>
            <NavLink to="/settings" className={linkClass}>
              <Settings size={16} /> Settings
            </NavLink>
            {profile?.role === "admin" && (
              <NavLink to="/admin" className={linkClass}>
                <ShieldCheck size={16} /> Admin
              </NavLink>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold leading-tight">
                {profile?.displayName || "User"}
              </div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-gold-600">
                {profile?.role === "admin" ? "Admin" : profile?.status}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav aria-label="Primary (mobile)" className="md:hidden flex items-center gap-1 overflow-x-auto px-4 pb-3">
          <NavLink to="/app" className={linkClass}>
            <Sparkles size={16} /> Studio
          </NavLink>
          <NavLink to="/pro" className={linkClass}>
            <LayoutDashboard size={16} /> Pro Studio
          </NavLink>
          <NavLink to="/gallery" className={linkClass}>
            <Images size={16} /> Gallery
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            <Settings size={16} /> Settings
          </NavLink>
          {profile?.role === "admin" && (
            <NavLink to="/admin" className={linkClass}>
              <ShieldCheck size={16} /> Admin
            </NavLink>
          )}
        </nav>
      </header>

      <Outlet />
    </div>
  );
};

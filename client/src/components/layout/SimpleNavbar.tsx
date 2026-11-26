import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Menu, X, LogOut, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SimpleNavbarProps {
  variant?: 'dark' | 'light';
}

export const SimpleNavbar: React.FC<SimpleNavbarProps> = ({ variant = 'light' }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isDark = variant === 'dark';

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md ${
        isDark
          ? 'bg-slate-900/90 border-slate-800 text-slate-100'
          : 'bg-white/90 border-slate-200 text-slate-900'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            MentorMinutes
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden sm:flex items-center gap-3">
          <Link
            to="/"
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Home
          </Link>

          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  isDark
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'text-slate-600 hover:text-rose-600 hover:bg-rose-50'
                }`}
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                  isDark
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
              >
                Get Started
              </Link>
            </>
          )}
        </nav>

        {/* Mobile Menu Toggle */}
        <button
          type="button"
          aria-label="Toggle navigation menu"
          onClick={() => setMobileOpen((prev) => !prev)}
          className={`sm:hidden p-2 rounded-xl transition-colors ${
            isDark
              ? 'text-slate-300 hover:bg-slate-800'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Dropdown */}
      {mobileOpen && (
        <div
          className={`sm:hidden border-t px-4 py-3 space-y-2 ${
            isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className={`block px-3 py-2 rounded-xl text-sm font-medium ${
              isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            Home
          </Link>

          {isAuthenticated ? (
            <>
              {user && (
                <div className={`px-3 py-1.5 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Signed in as <strong className={isDark ? 'text-white' : 'text-slate-900'}>{user.name}</strong> ({user.role})
                </div>
              )}
              <Link
                to="/dashboard"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white text-center"
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-3 py-2 rounded-xl text-sm font-medium text-rose-500 hover:bg-rose-500/10 text-left"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-xl text-sm font-medium ${
                  isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Sign In
              </Link>
              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white text-center"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
};

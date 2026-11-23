import React, { useState } from 'react';
import { Link, Navigate, NavLink, useNavigate } from 'react-router-dom';
import {
  Award,
  Bell,
  Calendar,
  FileSpreadsheet,
  Image,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Shield,
  ScrollText,
  Trophy,
  UserCheck,
  Users,
  X,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/src/app/AuthContext';

interface AdminLayoutProps {
  title: string;
  breadcrumb?: string;
  requireSuperAdmin?: boolean;
  children: React.ReactNode;
}

export function AdminLayout({
  title,
  breadcrumb = 'Admin',
  requireSuperAdmin = false,
  children,
}: AdminLayoutProps) {
  const { adminProfile, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate('/', { replace: true });
  };

  if (loggingOut) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] text-slate-900 admin-workspace flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#142D50] border-t-[#F28C28] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Verifying administrator session...</p>
        </div>
      </div>
    );
  }

  if (!adminProfile) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireSuperAdmin && adminProfile.role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-[#F4F6F8] text-slate-900 admin-workspace flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center">
          <h1 className="text-lg font-bold text-[#142D50]">Super Admin Access Required</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your role ({adminProfile.role.replace('_', ' ')}) does not have permission to view this section.
          </p>
          <Link
            to="/admin/dashboard"
            className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e]"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard Home', icon: LayoutDashboard, show: true },
    { to: '/admin/events', label: 'Events & Multiple Games', icon: Calendar, show: true },
    { to: '/admin/participants', label: 'Student Registrations', icon: Users, show: true },
    { to: '/admin/students', label: 'Student Logins & Activity', icon: UserCheck, show: true },
    { to: '/admin/certificates', label: 'Certificates & Winners', icon: Award, show: true },
    { to: '/admin/photos', label: 'Event Photo Gallery', icon: Image, show: true },
    { to: '/admin/results', label: 'Match Results', icon: Trophy, show: true },
    { to: '/admin/reports', label: 'Download Excel / CSV', icon: FileSpreadsheet, show: true },
    { to: '/admin/announcements', label: 'Notice Board', icon: Bell, show: true },
    {
      to: '/admin/admins',
      label: 'Admin Accounts',
      icon: Shield,
      show: adminProfile.role === 'super_admin',
    },
    {
      to: '/admin/settings',
      label: 'Website Settings',
      icon: Settings,
      show: adminProfile.role === 'super_admin',
    },
    { to: '/admin/audit-logs', label: 'Activity Logs', icon: ScrollText, show: true },
  ].filter((item) => item.show);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
      isActive
        ? 'bg-[#142D50] text-white'
        : 'text-slate-700 hover:bg-slate-100 hover:text-[#142D50]'
    }`;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0">
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-2.5 font-display font-bold text-base text-[#142D50] truncate"
        >
          <img
            src="/assets/aistudio/images__1__72d91f3a.jpeg"
            alt="GEC Khagaria logo"
            className="w-8 h-8 rounded-full object-contain bg-white border border-slate-200 p-0.5 shrink-0"
          />
          <span className="truncate">GEC Sports Admin</span>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Admin Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={navClass}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-200 space-y-2">
        <Link
          to="/"
          className="flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 rounded-lg hover:bg-slate-50 hover:text-[#142D50]"
        >
          <span>View Public Website</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
        <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-[#142D50] truncate">{adminProfile.displayName}</p>
          <p className="text-xs text-slate-500 truncate">{adminProfile.email}</p>
          <p className="mt-1 text-[11px] font-mono text-[#F28C28] font-medium">
            {adminProfile.role.replace('_', ' ')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-slate-900 admin-workspace flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen no-print">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 max-w-[80vw] h-full z-10">{sidebarContent}</aside>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Open admin menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">{breadcrumb}</p>
              <h1 className="text-lg font-display font-bold text-[#142D50] truncate">{title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/admin/events/new"
              className="hidden sm:inline-flex items-center px-3.5 py-2 text-xs font-semibold text-white bg-[#F28C28] rounded-lg hover:bg-[#dc7a1b] transition-colors whitespace-nowrap shrink-0"
            >
              Create Event
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

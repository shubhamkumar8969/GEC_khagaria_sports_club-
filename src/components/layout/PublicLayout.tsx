import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Ban, LogIn, LogOut, Menu, ShieldCheck, UserCheck, X } from 'lucide-react';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { logStudentActivity } from '@/src/services/firebase/students';

function describePublicRoute(pathname: string): string {
  if (pathname === '/') return 'Viewed Home Page';
  if (pathname === '/events') return 'Viewed Open Events List';
  if (pathname.startsWith('/events/') && pathname.includes('/games/')) {
    return 'Viewed Game Details Page';
  }
  if (pathname.startsWith('/events/')) return 'Viewed Event Details Page';
  if (pathname.startsWith('/register/')) return 'Opened Event Registration Form';
  if (pathname === '/results') return 'Viewed Match Results';
  if (pathname === '/photos') return 'Viewed Event Photos';
  if (pathname === '/announcements') return 'Viewed Notice Board';
  if (pathname === '/student/login') return 'Opened Student Login & Profile Setup';
  if (pathname === '/student' || pathname === '/portal' || pathname === '/my-registration') {
    return 'Viewed Student Dashboard & Certificates';
  }
  if (pathname === '/about') return 'Viewed About Page';
  if (pathname === '/contact') return 'Viewed Contact Page';
  return `Visited ${pathname}`;
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { settings } = useSiteSettings();
  const {
    firebaseUser,
    adminProfile,
    studentProfile,
    studentAccount,
    isStudentBlocked,
    logout,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastTrackedPathRef = useRef<string>('');

  const isHomePage = location.pathname === '/';

  const handleLogout = async () => {
    setMobileOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  useEffect(() => {
    if (!firebaseUser?.uid || !firebaseUser.email || adminProfile || isStudentBlocked) {
      return;
    }
    const fullPath = `${location.pathname}${location.search}`;
    if (lastTrackedPathRef.current === fullPath) return;
    lastTrackedPathRef.current = fullPath;

    const pathSegments = location.pathname.split('/').filter(Boolean);
    const eventId =
      pathSegments[0] === 'events' || pathSegments[0] === 'register' ? pathSegments[1] || '' : '';
    const gameId =
      pathSegments[0] === 'register'
        ? pathSegments[2] || ''
        : pathSegments[0] === 'events' && pathSegments[2] === 'games'
        ? pathSegments[3] || ''
        : '';

    void logStudentActivity({
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      studentName: studentProfile?.fullName || firebaseUser.displayName || '',
      registrationNumber: studentProfile?.registrationNumber || '',
      action: 'page_view',
      summary: describePublicRoute(location.pathname),
      path: fullPath,
      eventId,
      gameId,
    });
  }, [
    firebaseUser?.uid,
    firebaseUser?.email,
    firebaseUser?.displayName,
    adminProfile,
    isStudentBlocked,
    studentProfile?.fullName,
    studentProfile?.registrationNumber,
    location.pathname,
    location.search,
  ]);

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
      isActive
        ? 'text-white border-amber-400 font-semibold'
        : 'text-slate-300 border-transparent hover:text-white hover:border-sky-400/80'
    }`;

  const studentDisplayName =
    studentProfile?.fullName || firebaseUser?.displayName || 'Student Dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-[#060913] text-slate-100">
      {/* Multi-Sport Championship Spectrum Ribbon + Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 bg-[#0A0F1D]/95 backdrop-blur-md border-b border-sky-500/25 shadow-[0_8px_24px_rgba(0,0,0,0.6)] no-print">
        <div
          className="h-1 w-full bg-gradient-to-r from-[#EF4444] via-[#F59E0B] via-[#10B981] to-[#2563EB]"
          aria-hidden="true"
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
          {/* Zone 1: Single-line Brand Wordmark with Official Logo */}
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <img
              src="/assets/aistudio/images__1__72d91f3a.jpeg"
              alt={`${settings.clubName} logo`}
              className="w-9 h-9 rounded-full object-contain bg-white border border-amber-400/70 p-0.5 shadow-sm shrink-0"
            />
            <span>{settings.clubName}</span>
          </Link>

          {/* Zone 2: Compulsory Home + concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-5 lg:gap-6" aria-label="Primary Navigation">
            <NavLink to="/" end className={navLinkClass}>
              Home
            </NavLink>
            <NavLink to="/events" className={navLinkClass}>
              Events
            </NavLink>
            <NavLink to="/results" className={navLinkClass}>
              Results
            </NavLink>
            <NavLink to="/photos" className={navLinkClass}>
              Photos
            </NavLink>
            <NavLink to="/announcements" className={navLinkClass}>
              Notices
            </NavLink>
            {firebaseUser ? (
              <NavLink to="/student" className={navLinkClass}>
                Dashboard
              </NavLink>
            ) : (
              <NavLink to="/about" className={navLinkClass}>
                About
              </NavLink>
            )}
          </nav>

          {/* Zone 3: My Profile & Student Dashboard when signed in, or Student Login ONLY on Home Page */}
          <div className="flex items-center gap-2.5 shrink-0">
            {firebaseUser ? (
              <>
                <Link
                  to="/student?profile=edit"
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-100 bg-[#080B14] border border-blue-500/35 rounded-lg hover:border-amber-400 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>My Profile</span>
                </Link>
                <Link
                  to="/student"
                  className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg btn-3d-blue whitespace-nowrap shrink-0 max-w-[200px]"
                >
                  <UserCheck className="w-3.5 h-3.5 text-red-300 shrink-0" />
                  <span className="truncate">{studentDisplayName}</span>
                </Link>
              </>
            ) : isHomePage ? (
              <Link
                to="/student/login"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg btn-3d-mix whitespace-nowrap shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 text-white shrink-0" />
                <span>Student Login</span>
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-lg text-slate-200 hover:bg-white/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden bg-[#0B101D] border-b border-blue-500/25 px-4 py-4 space-y-1.5">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-slate-200 rounded-lg hover:bg-blue-950/60"
            >
              Home
            </Link>
            <Link
              to="/events"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-slate-200 rounded-lg hover:bg-blue-950/60"
            >
              Live Events
            </Link>
            <Link
              to="/results"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-slate-200 rounded-lg hover:bg-blue-950/60"
            >
              Results Panel
            </Link>
            <Link
              to="/photos"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-slate-200 rounded-lg hover:bg-blue-950/60"
            >
              Event Photos
            </Link>
            <Link
              to="/announcements"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-slate-200 rounded-lg hover:bg-blue-950/60"
            >
              Notices
            </Link>
            <Link
              to="/about"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-slate-200 rounded-lg hover:bg-blue-950/60"
            >
              About Club
            </Link>
            <Link
              to="/contact"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2.5 text-sm font-medium text-slate-200 rounded-lg hover:bg-blue-950/60"
            >
              Contact
            </Link>
            {(firebaseUser || isHomePage) && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                {firebaseUser ? (
                  <>
                    <Link
                      to="/student?profile=edit"
                      onClick={() => setMobileOpen(false)}
                      className="block w-full text-center px-4 py-2 text-sm font-medium text-blue-200 bg-[#080B14] border border-blue-500/35 rounded-lg"
                    >
                      My Profile / Edit Profile
                    </Link>
                    <Link
                      to="/student"
                      onClick={() => setMobileOpen(false)}
                      className="block w-full text-center px-4 py-2.5 text-sm font-semibold rounded-lg btn-3d-blue"
                    >
                      Student Dashboard &amp; Certificates
                    </Link>
                  </>
                ) : (
                  <Link
                    to="/student/login"
                    onClick={() => setMobileOpen(false)}
                    className="block w-full text-center px-4 py-2.5 text-sm font-semibold rounded-lg btn-3d-mix"
                  >
                    Student Login
                  </Link>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {isStudentBlocked && (
        <div className="bg-red-950/90 border-b border-red-500/50 text-red-100 px-4 py-3 no-print">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                <strong>Account Blocked by Administrator:</strong>{' '}
                {studentAccount?.blockedReason ||
                  'Your student access has been restricted by the Sports Club Admin.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-red-900/70 border border-red-400/50 rounded-lg hover:bg-red-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      {/* Footer ONLY shown on the Home Page */}
      {isHomePage && (
        <footer className="bg-footer-arena text-slate-300 border-t border-sky-500/20 no-print">
          <div
            className="h-1 w-full bg-gradient-to-r from-[#EF4444] via-[#F59E0B] via-[#10B981] to-[#2563EB]"
            aria-hidden="true"
          />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {!firebaseUser && (
              <div className="pb-8 mb-6 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-3">
                  <img
                    src="/assets/aistudio/images__1__72d91f3a.jpeg"
                    alt={`${settings.clubName} emblem`}
                    className="w-10 h-10 rounded-full object-contain bg-white p-0.5 border border-red-400/50 shadow-sm shrink-0"
                  />
                  <div>
                    <h2 className="font-display text-base font-bold text-white leading-tight">
                      {settings.clubName}
                    </h2>
                    <p className="text-xs text-blue-300">{settings.institutionName}</p>
                  </div>
                </div>

                <Link
                  to="/admin/login"
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#DC2626]/25 to-[#1D4ED8]/30 border border-red-500/40 rounded-lg hover:border-red-400 hover:bg-red-950/40 transition-all shadow-sm w-fit"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>Admin Login</span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                </Link>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
              <p>
                &copy; {new Date().getFullYear()} {settings.clubName} · {settings.institutionName}
              </p>
              <p>Student data is protected and accessible only to authorized club administrators.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

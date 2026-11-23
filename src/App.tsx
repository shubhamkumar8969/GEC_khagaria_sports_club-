import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/src/app/AuthContext';
import { SettingsProvider } from '@/src/app/SettingsContext';
import { ErrorBoundary } from '@/src/components/common/ErrorBoundary';

import { HomePage } from '@/src/pages/public/HomePage';
import { AboutPage } from '@/src/pages/public/AboutPage';
import { EventsPage } from '@/src/pages/public/EventsPage';
import { EventDetailPage } from '@/src/pages/public/EventDetailPage';
import { GameDetailPage } from '@/src/pages/public/GameDetailPage';
import { RegisterPage } from '@/src/pages/public/RegisterPage';
import { ResultsPage } from '@/src/pages/public/ResultsPage';
import { PhotosPage } from '@/src/pages/public/PhotosPage';
import { StudentAuthPage } from '@/src/pages/public/StudentAuthPage';
import { StudentPortalPage } from '@/src/pages/public/StudentPortalPage';
import { AnnouncementsPage } from '@/src/pages/public/AnnouncementsPage';
import { ContactPage } from '@/src/pages/public/ContactPage';

const AdminLoginPage = lazy(() =>
  import('@/src/pages/admin/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage }))
);
const AdminDashboardPage = lazy(() =>
  import('@/src/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage }))
);
const AdminEventsPage = lazy(() =>
  import('@/src/pages/admin/AdminEventsPage').then((m) => ({ default: m.AdminEventsPage }))
);
const AdminEventEditorPage = lazy(() =>
  import('@/src/pages/admin/AdminEventEditorPage').then((m) => ({
    default: m.AdminEventEditorPage,
  }))
);
const AdminGamesPage = lazy(() =>
  import('@/src/pages/admin/AdminGamesPage').then((m) => ({ default: m.AdminGamesPage }))
);
const AdminGameEditorPage = lazy(() =>
  import('@/src/pages/admin/AdminGameEditorPage').then((m) => ({
    default: m.AdminGameEditorPage,
  }))
);
const AdminParticipantsPage = lazy(() =>
  import('@/src/pages/admin/AdminParticipantsPage').then((m) => ({
    default: m.AdminParticipantsPage,
  }))
);
const AdminStudentsPage = lazy(() =>
  import('@/src/pages/admin/AdminStudentsPage').then((m) => ({
    default: m.AdminStudentsPage,
  }))
);
const AdminRegistrationDetailPage = lazy(() =>
  import('@/src/pages/admin/AdminRegistrationDetailPage').then((m) => ({
    default: m.AdminRegistrationDetailPage,
  }))
);
const AdminCertificatesPage = lazy(() =>
  import('@/src/pages/admin/AdminCertificatesPage').then((m) => ({
    default: m.AdminCertificatesPage,
  }))
);
const AdminPhotosPage = lazy(() =>
  import('@/src/pages/admin/AdminPhotosPage').then((m) => ({ default: m.AdminPhotosPage }))
);
const AdminResultsPage = lazy(() =>
  import('@/src/pages/admin/AdminResultsPage').then((m) => ({ default: m.AdminResultsPage }))
);
const AdminReportsPage = lazy(() =>
  import('@/src/pages/admin/AdminReportsPage').then((m) => ({ default: m.AdminReportsPage }))
);
const AdminAnnouncementsPage = lazy(() =>
  import('@/src/pages/admin/AdminAnnouncementsPage').then((m) => ({
    default: m.AdminAnnouncementsPage,
  }))
);
const AdminUsersPage = lazy(() =>
  import('@/src/pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage }))
);
const AdminSettingsPage = lazy(() =>
  import('@/src/pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage }))
);
const AdminAuditLogsPage = lazy(() =>
  import('@/src/pages/admin/AdminAuditLogsPage').then((m) => ({ default: m.AdminAuditLogsPage }))
);

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#07090F] flex items-center justify-center p-6">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-red-500 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <BrowserRouter>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<HomePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/events" element={<EventsPage />} />
                <Route path="/events/:eventId" element={<EventDetailPage />} />
                <Route path="/events/:eventId/games/:gameId" element={<GameDetailPage />} />
                <Route path="/register/:eventId/:gameId" element={<RegisterPage />} />
                <Route path="/results" element={<ResultsPage />} />
                <Route path="/photos" element={<PhotosPage />} />
                <Route path="/student/login" element={<StudentAuthPage />} />
                <Route path="/student" element={<StudentPortalPage />} />
                <Route path="/portal" element={<StudentPortalPage />} />
                <Route path="/my-registration" element={<StudentPortalPage />} />
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/contact" element={<ContactPage />} />

                {/* Admin Routes */}
                <Route path="/admin/login" element={<AdminLoginPage />} />
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/events" element={<AdminEventsPage />} />
                <Route path="/admin/events/new" element={<AdminEventEditorPage />} />
                <Route path="/admin/events/:id/edit" element={<AdminEventEditorPage />} />
                <Route path="/admin/events/:id/games" element={<AdminGamesPage />} />
                <Route path="/admin/events/:id/games/new" element={<AdminGameEditorPage />} />
                <Route path="/admin/events/:id/games/:gameId/edit" element={<AdminGameEditorPage />} />
                <Route path="/admin/participants" element={<AdminParticipantsPage />} />
                <Route path="/admin/students" element={<AdminStudentsPage />} />
                <Route path="/admin/registrations/:id" element={<AdminRegistrationDetailPage />} />
                <Route path="/admin/certificates" element={<AdminCertificatesPage />} />
                <Route path="/admin/photos" element={<AdminPhotosPage />} />
                <Route path="/admin/results" element={<AdminResultsPage />} />
                <Route path="/admin/reports" element={<AdminReportsPage />} />
                <Route path="/admin/announcements" element={<AdminAnnouncementsPage />} />
                <Route path="/admin/admins" element={<AdminUsersPage />} />
                <Route path="/admin/settings" element={<AdminSettingsPage />} />
                <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />

                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

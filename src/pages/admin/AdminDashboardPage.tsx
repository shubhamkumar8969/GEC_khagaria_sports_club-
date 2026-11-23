import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Calendar, FileSpreadsheet, Image, Megaphone, Plus, UserCheck, Users } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { useAuth } from '@/src/app/AuthContext';
import { listAllEventsForAdmin } from '@/src/services/firebase/events';
import { listRegistrationsForAdmin } from '@/src/services/firebase/registrations';
import {
  listAllStudentAccountsForAdmin,
  listAllStudentProfilesForAdmin,
  syncPublicStudentCount,
} from '@/src/services/firebase/students';
import { formatDate, formatDateTime } from '@/src/utils/formatters';
import type { Registration, SportEvent } from '@/src/types/models';

export function AdminDashboardPage() {
  const { adminProfile } = useAuth();
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [totalStudentLogins, setTotalStudentLogins] = useState(0);
  const [blockedStudentsCount, setBlockedStudentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminProfile) return;
    let active = true;
    async function load() {
      try {
        const [evList, regList, acctList, profList] = await Promise.all([
          listAllEventsForAdmin(adminProfile!),
          listRegistrationsForAdmin(adminProfile!),
          listAllStudentAccountsForAdmin().catch(() => []),
          listAllStudentProfilesForAdmin().catch(() => []),
        ]);
        if (!active) return;
        const distinctUids = new Set<string>([
          ...acctList.map((a) => a.uid),
          ...profList.map((p) => p.uid),
        ]);
        setEvents(evList);
        setRegistrations(regList);
        setTotalStudentLogins(distinctUids.size);
        setBlockedStudentsCount(acctList.filter((a) => a.status === 'blocked').length);
        void syncPublicStudentCount(distinctUids.size, adminProfile?.uid || '');
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [adminProfile]);

  const activeEventsCount = useMemo(
    () =>
      events.filter((e) =>
        ['published', 'registration_open', 'ongoing'].includes(e.status)
      ).length,
    [events]
  );

  const confirmedEntriesCount = useMemo(
    () => registrations.filter((r) => r.registrationStatus === 'approved').length,
    [registrations]
  );

  const byGameCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registrations) {
      const key = `${r.gameName} (${r.eventName})`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [registrations]);

  const statusBreakdown = useMemo(() => {
    const statuses = ['approved', 'pending', 'waitlisted', 'rejected', 'withdrawn', 'cancelled'] as const;
    return statuses.map((s) => ({
      status: s,
      count: registrations.filter((r) => r.registrationStatus === s).length,
    }));
  }, [registrations]);

  const maxGameCount = Math.max(1, ...byGameCounts.map(([, c]) => c));

  return (
    <AdminLayout title="Dashboard" breadcrumb="Overview">
      <div className="space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Total Events</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#142D50] tabular-nums">
              {loading ? '—' : events.length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Active / Open Events</p>
            <p className="mt-2 font-display text-3xl font-bold text-emerald-700 tabular-nums">
              {loading ? '—' : activeEventsCount}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Total Registrations</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#142D50] tabular-nums">
              {loading ? '—' : registrations.length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Confirmed Entries</p>
            <p className="mt-2 font-display text-3xl font-bold text-[#F28C28] tabular-nums">
              {loading ? '—' : confirmedEntriesCount}
            </p>
          </div>
          <Link
            to="/admin/students"
            className="bg-white border border-slate-200 rounded-xl p-5 hover:border-[#142D50] transition-colors block"
          >
            <p className="text-xs font-medium text-slate-500">Logged-In Students</p>
            <p className="mt-2 font-display text-3xl font-bold text-blue-700 tabular-nums">
              {loading ? '—' : totalStudentLogins}
            </p>
            {!loading && blockedStudentsCount > 0 && (
              <p className="mt-1 text-[11px] font-medium text-red-600">
                {blockedStudentsCount} blocked
              </p>
            )}
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#142D50] mb-3">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            {adminProfile?.role === 'super_admin' && (
              <Link
                to="/admin/events/new"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Event</span>
              </Link>
            )}
            <Link
              to="/admin/events"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-[#F4F6F8] border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Manage Events & Games</span>
            </Link>
            <Link
              to="/admin/participants"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-[#F4F6F8] border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Review Participants</span>
            </Link>
            <Link
              to="/admin/students"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-[#F4F6F8] border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-700" />
              <span>Student Logins &amp; Activity</span>
            </Link>
            <Link
              to="/admin/certificates"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-[#F4F6F8] border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              <Award className="w-3.5 h-3.5 text-[#F28C28]" />
              <span>Distribute Certificates</span>
            </Link>
            <Link
              to="/admin/photos"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-[#F4F6F8] border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              <Image className="w-3.5 h-3.5 text-[#F28C28]" />
              <span>Upload Event Photos</span>
            </Link>
            <Link
              to="/admin/reports"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-[#F4F6F8] border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Export Excel / CSV</span>
            </Link>
            <Link
              to="/admin/announcements"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-[#F4F6F8] border border-slate-200 rounded-lg hover:bg-slate-200"
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Post Notice</span>
            </Link>
          </div>
        </div>

        {/* Real Firestore Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-base font-bold text-[#142D50] mb-4">
              Registrations by Game
            </h2>
            {loading ? (
              <div className="h-44 bg-slate-100 rounded animate-pulse" />
            ) : byGameCounts.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                No registrations recorded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {byGameCounts.map(([label, count]) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700 truncate pr-4">{label}</span>
                      <span className="font-mono font-semibold text-[#142D50] tabular-nums">
                        {count}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#142D50] rounded-full"
                        style={{ width: `${Math.round((count / maxGameCount) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-base font-bold text-[#142D50] mb-4">
              Registration Status Distribution
            </h2>
            {loading ? (
              <div className="h-44 bg-slate-100 rounded animate-pulse" />
            ) : (
              <div className="space-y-3">
                {statusBreakdown.map((item) => {
                  const pct =
                    registrations.length > 0
                      ? Math.round((item.count / registrations.length) * 100)
                      : 0;
                  return (
                    <div key={item.status} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <StatusTag status={item.status} />
                        <span className="font-mono text-slate-700 tabular-nums">
                          {item.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#F28C28] rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Registrations & Events */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#142D50]">
                Recent Registrations
              </h2>
              <Link
                to="/admin/participants"
                className="text-xs font-semibold text-[#142D50] hover:text-[#F28C28]"
              >
                View All
              </Link>
            </div>
            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading registrations...</div>
            ) : registrations.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No registrations submitted yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4">Participant</th>
                      <th className="py-3 px-4">Event / Game</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {registrations.slice(0, 8).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <Link
                            to={`/admin/registrations/${r.id}`}
                            className="font-medium text-[#142D50] hover:underline"
                          >
                            {r.participant.fullName}
                          </Link>
                          <p className="text-xs font-mono text-slate-500">
                            {r.participant.enrollmentNumber}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-slate-900">{r.gameName}</p>
                          <p className="text-xs text-slate-500">{r.eventName}</p>
                        </td>
                        <td className="py-3 px-4">
                          <StatusTag status={r.registrationStatus} />
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-slate-500 tabular-nums">
                          {formatDateTime(r.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#142D50]">Events</h2>
              <Link
                to="/admin/events"
                className="text-xs font-semibold text-[#142D50] hover:text-[#F28C28]"
              >
                Manage
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {events.length === 0 ? (
                <div className="p-6 text-sm text-slate-500 text-center">
                  No events created yet. Use Settings to seed UMANG&apos;27 or create an event.
                </div>
              ) : (
                events.slice(0, 6).map((evt) => (
                  <div key={evt.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/events/${evt.id}/games`}
                        className="font-semibold text-sm text-[#142D50] hover:underline truncate block"
                      >
                        {evt.name}
                      </Link>
                      <p className="text-xs text-slate-500 tabular-nums">
                        {formatDate(evt.startAt)}
                      </p>
                    </div>
                    <StatusTag status={evt.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

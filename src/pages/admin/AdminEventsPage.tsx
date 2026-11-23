import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, Edit, ExternalLink, Gamepad2, Plus, Search, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { ConfirmModal } from '@/src/components/common/ConfirmModal';
import { useAuth } from '@/src/app/AuthContext';
import {
  deleteEvent,
  duplicateEvent,
  listAllEventsForAdmin,
  listAllGames,
  updateEventStatus,
} from '@/src/services/firebase/events';
import { formatDate } from '@/src/utils/formatters';
import type { EventStatus, SportEvent } from '@/src/types/models';

export function AdminEventsPage() {
  const { adminProfile } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [gameCounts, setGameCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all');
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SportEvent | null>(null);

  const loadEvents = useCallback(async () => {
    if (!adminProfile) return;
    setLoading(true);
    try {
      const list = await listAllEventsForAdmin(adminProfile);
      setEvents(list);
      const countsArr = await Promise.all(
        list.map(async (ev) => {
          try {
            const gms = await listAllGames(ev.id);
            return [ev.id, gms.length] as const;
          } catch {
            return [ev.id, 0] as const;
          }
        })
      );
      const countMap: Record<string, number> = {};
      for (const [eid, count] of countsArr) countMap[eid] = count;
      setGameCounts(countMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [adminProfile]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q);
    });
  }, [events, search, statusFilter]);

  const handleDuplicate = async (evt: SportEvent) => {
    if (!adminProfile) return;
    try {
      const newId = await duplicateEvent(evt, adminProfile);
      navigate(`/admin/events/${newId}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate event.');
    }
  };

  const handleStatusChange = async (evt: SportEvent, nextStatus: EventStatus) => {
    if (!adminProfile) return;
    try {
      await updateEventStatus(evt.id, evt.name, nextStatus, adminProfile);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    }
  };

  const handleDeleteEvent = async () => {
    if (!deleteTarget || !adminProfile) return;
    try {
      await deleteEvent(deleteTarget, adminProfile);
      setDeleteTarget(null);
      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete event.');
    }
  };

  return (
    <AdminLayout title="Events & Multiple Games" breadcrumb="Admin / Events">
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-[#142D50]">
          <strong>Multi-Game Tip:</strong> Each event (like <strong>UMANG</strong>) can contain
          multiple games such as <strong>Cricket, Volleyball, Kabaddi, Football, Badminton</strong>,
          and more. Click <strong>Add / Manage Games</strong> on any event row to add multiple
          games at once.
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search event name or ground..."
                className="w-full pl-9 pr-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | EventStatus)}
              className="px-3 py-2 bg-white text-slate-900 border border-slate-300 rounded-lg text-sm"
            >
              <option value="all">All Event Statuses</option>
              <option value="draft">Draft (Hidden)</option>
              <option value="published">Live · Published</option>
              <option value="registration_open">Live · Registration Open</option>
              <option value="registration_closed">Registration Closed</option>
              <option value="ongoing">Live · Ongoing</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {adminProfile?.role === 'super_admin' && (
            <Link
              to="/admin/events/new"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Event</span>
            </Link>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="font-semibold text-[#142D50]">No events found</p>
            <p className="mt-1 text-sm text-slate-600">
              Create your first sports event or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Event Name &amp; Ground</th>
                    <th className="py-3 px-4">Event &amp; Registration Dates</th>
                    <th className="py-3 px-4">Current Status</th>
                    <th className="py-3 px-4">Change Visibility Status</th>
                    <th className="py-3 px-4 text-right">Games &amp; Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((evt) => {
                    const count = gameCounts[evt.id] ?? 0;
                    return (
                      <tr key={evt.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-[#142D50]">{evt.name}</p>
                          <p className="text-xs text-slate-500">{evt.venue || 'No ground set'}</p>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums">
                          <p>
                            Event: {formatDate(evt.startAt)} – {formatDate(evt.endAt)}
                          </p>
                          <p className="text-slate-500">
                            Registration: {formatDate(evt.registrationStartAt)} –{' '}
                            {formatDate(evt.registrationEndAt)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <StatusTag status={evt.status} />
                        </td>
                        <td className="py-3.5 px-4">
                          <select
                            aria-label={`Change status for ${evt.name}`}
                            value={evt.status}
                            onChange={(e) =>
                              void handleStatusChange(evt, e.target.value as EventStatus)
                            }
                            className="text-xs border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-900"
                          >
                            <option value="draft">Draft (Hidden)</option>
                            <option value="published">Live · Published</option>
                            <option value="registration_open">Live · Registration Open</option>
                            <option value="registration_closed">Registration Closed</option>
                            <option value="ongoing">Live · Ongoing</option>
                            <option value="completed">Completed</option>
                            <option value="archived">Archived</option>
                          </select>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <Link
                              to={`/admin/events/${evt.id}/games`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#142D50] rounded-md hover:bg-[#1c3e6e] whitespace-nowrap"
                            >
                              <Gamepad2 className="w-3.5 h-3.5 text-[#F28C28]" />
                              <span>Add / Manage Games ({count})</span>
                            </Link>
                            <Link
                              to={`/admin/events/${evt.id}/edit`}
                              className="p-1.5 text-slate-600 hover:text-[#142D50]"
                              title="Edit event details"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <Link
                              to={`/events/${evt.id}`}
                              className="p-1.5 text-slate-600 hover:text-[#142D50]"
                              title="View public event page"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                            {adminProfile?.role === 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => void handleDuplicate(evt)}
                                className="p-1.5 text-slate-600 hover:text-[#142D50]"
                                title="Copy this event and all its games"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                            {adminProfile?.role === 'super_admin' && (
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(evt)}
                                className="p-1.5 text-red-600 hover:text-red-800"
                                title="Delete event"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Event"
        description={`Permanently delete event "${deleteTarget?.name}" and all of its games? This cannot be undone.`}
        confirmLabel="Delete Event"
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteEvent()}
      />
    </AdminLayout>
  );
}

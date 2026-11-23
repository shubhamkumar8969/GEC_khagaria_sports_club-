import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listAllEventsForAdmin, listAllGames } from '@/src/services/firebase/events';
import { listRegistrationsForAdmin } from '@/src/services/firebase/registrations';
import { exportRegistrations } from '@/src/services/exports/exportService';
import type { EventGame, Registration, SportEvent } from '@/src/types/models';

export function AdminReportsPage() {
  const { adminProfile } = useAuth();
  const { settings } = useSiteSettings();

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [gamesByEvent, setGamesByEvent] = useState<Record<string, EventGame[]>>({});
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [eventFilter, setEventFilter] = useState('all');
  const [gameFilter, setGameFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!adminProfile) return;
    let active = true;
    async function load() {
      try {
        const [evList, regList] = await Promise.all([
          listAllEventsForAdmin(adminProfile!),
          listRegistrationsForAdmin(adminProfile!),
        ]);
        const gameEntries = await Promise.all(
          evList.map(async (evt) => [evt.id, await listAllGames(evt.id)] as const)
        );
        if (!active) return;
        setEvents(evList);
        setRegistrations(regList);
        const gMap: Record<string, EventGame[]> = {};
        for (const [eid, gms] of gameEntries) gMap[eid] = gms;
        setGamesByEvent(gMap);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load reports.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [adminProfile]);

  useEffect(() => {
    setGameFilter('all');
  }, [eventFilter]);

  const availableGames = useMemo(
    () => (eventFilter === 'all' ? Object.values(gamesByEvent).flat() : gamesByEvent[eventFilter] || []),
    [eventFilter, gamesByEvent]
  );

  const gamesById = useMemo(() => {
    const map: Record<string, EventGame> = {};
    for (const g of Object.values(gamesByEvent).flat()) map[g.id] = g;
    return map;
  }, [gamesByEvent]);

  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      if (eventFilter !== 'all' && r.eventId !== eventFilter) return false;
      if (gameFilter !== 'all' && r.gameId !== gameFilter) return false;
      if (branchFilter !== 'all' && r.participant.branch !== branchFilter) return false;
      if (statusFilter !== 'all' && r.registrationStatus !== statusFilter) return false;
      return true;
    });
  }, [registrations, eventFilter, gameFilter, branchFilter, statusFilter]);

  const summaryRows = useMemo(() => {
    const map = new Map<
      string,
      { eventName: string; gameName: string; total: number; approved: number; pending: number }
    >();
    for (const r of filtered) {
      const key = `${r.eventId}__${r.gameId}`;
      const existing = map.get(key) || {
        eventName: r.eventName,
        gameName: r.gameName,
        total: 0,
        approved: 0,
        pending: 0,
      };
      existing.total += 1;
      if (r.registrationStatus === 'approved') existing.approved += 1;
      if (r.registrationStatus === 'pending') existing.pending += 1;
      map.set(key, existing);
    }
    return Array.from(map.values());
  }, [filtered]);

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!adminProfile) return;
    try {
      await exportRegistrations({
        format,
        scopeLabel: `Filtered report (${filtered.length} records)`,
        registrations: filtered,
        gamesById,
        actor: adminProfile,
        filterSummary: `event=${eventFilter}, game=${gameFilter}, branch=${branchFilter}, status=${statusFilter}`,
      });
      setNotice(
        `Generated ${format.toUpperCase()} export with ${filtered.length} matching records and recorded in Audit Logs.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  return (
    <AdminLayout title="Reports & Exports" breadcrumb="Admin / Reports">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm">
            {notice}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#142D50]">Export Builder</h2>
              <p className="text-xs text-slate-600">
                Excel workbooks include 4 sheets: Registrations, Team Members, Summary, and Custom
                Answers. Formula characters are escaped automatically.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={filtered.length === 0 || loading}
                onClick={() => void handleExport('xlsx')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                disabled={filtered.length === 0 || loading}
                onClick={() => void handleExport('csv')}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>Download CSV</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
            >
              <option value="all">All Accessible Events</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name}
                </option>
              ))}
            </select>

            <select
              value={gameFilter}
              onChange={(e) => setGameFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
            >
              <option value="all">All Games</option>
              {availableGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
            >
              <option value="all">All Branches</option>
              {settings.branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-900"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="rejected">Cancelled / Ineligible</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-[#142D50]">
              Summary Preview ({filtered.length} matching registrations)
            </h3>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading report summary...</div>
          ) : summaryRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No records match the selected report filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Event</th>
                    <th className="py-3 px-4">Game</th>
                    <th className="py-3 px-4 text-right">Total Entries</th>
                    <th className="py-3 px-4 text-right">Approved</th>
                    <th className="py-3 px-4 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summaryRows.map((row) => (
                    <tr key={`${row.eventName}_${row.gameName}`}>
                      <td className="py-3 px-4 font-medium text-[#142D50]">{row.eventName}</td>
                      <td className="py-3 px-4 text-slate-700">{row.gameName}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{row.total}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-700">
                        {row.approved}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-700">
                        {row.pending}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

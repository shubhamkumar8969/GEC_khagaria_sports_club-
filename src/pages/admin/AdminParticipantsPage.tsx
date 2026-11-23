import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Check, Download, Eye, Search, X } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { ConfirmModal } from '@/src/components/common/ConfirmModal';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listAllEventsForAdmin, listAllGames } from '@/src/services/firebase/events';
import {
  bulkIssueCertificates,
  bulkUpdateRegistrationStatus,
  listRegistrationsForAdmin,
  updateRegistrationDetails,
} from '@/src/services/firebase/registrations';
import { exportRegistrations } from '@/src/services/exports/exportService';
import { maskEmail, maskPhone } from '@/src/schemas/validation';
import { formatDate } from '@/src/utils/formatters';
import type {
  EventGame,
  ParticipationType,
  Registration,
  RegistrationStatus,
  SportEvent,
} from '@/src/types/models';

export function AdminParticipantsPage() {
  const { adminProfile } = useAuth();
  const { settings } = useSiteSettings();

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [gamesByEvent, setGamesByEvent] = useState<Record<string, EventGame[]>>({});
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Search (with debounce) & Filters
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [gameFilter, setGameFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ParticipationType>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Pagination
  const [pageSize, setPageSize] = useState<25 | 50 | 100>(25);
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<RegistrationStatus | null>(null);
  const [bulkCertMode, setBulkCertMode] = useState<'issue' | 'revoke' | null>(null);
  const [bulkCertTitle, setBulkCertTitle] = useState('');
  const [bulkCertNote, setBulkCertNote] = useState('');
  const [bulkCertBusy, setBulkCertBusy] = useState(false);
  const [rowAction, setRowAction] = useState<{
    reg: Registration;
    nextStatus: RegistrationStatus;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim().toLowerCase()), 220);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadData = useCallback(async () => {
    if (!adminProfile) return;
    setLoading(true);
    try {
      const [evList, regList] = await Promise.all([
        listAllEventsForAdmin(adminProfile),
        listRegistrationsForAdmin(adminProfile),
      ]);
      setEvents(evList);
      setRegistrations(regList);

      const gameEntries = await Promise.all(
        evList.map(async (evt) => [evt.id, await listAllGames(evt.id)] as const)
      );
      const map: Record<string, EventGame[]> = {};
      for (const [eid, gms] of gameEntries) {
        map[eid] = gms;
      }
      setGamesByEvent(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load participants.');
    } finally {
      setLoading(false);
    }
  }, [adminProfile]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Reset dependent game filter when event changes
  useEffect(() => {
    setGameFilter('all');
    setPage(1);
  }, [eventFilter]);

  const availableGames = useMemo(() => {
    if (eventFilter === 'all') {
      return Object.values(gamesByEvent).flat();
    }
    return gamesByEvent[eventFilter] || [];
  }, [eventFilter, gamesByEvent]);

  const gamesById = useMemo(() => {
    const map: Record<string, EventGame> = {};
    for (const g of Object.values(gamesByEvent).flat()) {
      map[g.id] = g;
    }
    return map;
  }, [gamesByEvent]);

  const filtered = useMemo(() => {
    return registrations.filter((r) => {
      if (eventFilter !== 'all' && r.eventId !== eventFilter) return false;
      if (gameFilter !== 'all' && r.gameId !== gameFilter) return false;
      if (branchFilter !== 'all' && r.participant.branch !== branchFilter) return false;
      if (yearFilter !== 'all' && r.participant.year !== yearFilter) return false;
      if (statusFilter !== 'all' && r.registrationStatus !== statusFilter) return false;
      if (typeFilter !== 'all' && r.participationType !== typeFilter) return false;
      if (progressFilter !== 'all') {
        if (
          r.selectionStatus !== progressFilter &&
          r.matchStatus !== progressFilter &&
          r.result !== progressFilter
        ) {
          return false;
        }
      }
      if (fromDate && r.createdAt?.toDate) {
        if (r.createdAt.toDate() < new Date(fromDate)) return false;
      }
      if (toDate && r.createdAt?.toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        if (r.createdAt.toDate() > end) return false;
      }
      if (debouncedSearch) {
        const hay = [
          r.participant.fullName,
          r.participant.enrollmentNumber,
          r.participant.phone,
          r.participant.email,
          r.team.teamName,
          r.registrationReference,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(debouncedSearch)) return false;
      }
      return true;
    });
  }, [
    registrations,
    eventFilter,
    gameFilter,
    branchFilter,
    yearFilter,
    statusFilter,
    progressFilter,
    typeFilter,
    fromDate,
    toDate,
    debouncedSearch,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const canModifyRegStatus =
    adminProfile?.role === 'super_admin' || adminProfile?.role === 'event_admin';
  const showFullPII =
    adminProfile?.role === 'super_admin' || adminProfile?.role === 'event_admin';

  const allPageSelected =
    pageItems.length > 0 && pageItems.every((r) => selectedIds.has(r.id));

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageItems.forEach((r) => next.delete(r.id));
      } else {
        pageItems.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((r) => r.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedRecords = useMemo(
    () => filtered.filter((r) => selectedIds.has(r.id)),
    [filtered, selectedIds]
  );

  const handleBulkConfirm = async (reason: string) => {
    if (!adminProfile || !bulkAction || selectedRecords.length === 0) return;
    try {
      const count = await bulkUpdateRegistrationStatus(
        selectedRecords,
        bulkAction,
        reason,
        adminProfile
      );
      setFeedback(`Updated ${count} registration(s) to "${bulkAction}".`);
      setBulkAction(null);
      clearSelection();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk update failed.');
    }
  };

  const handleBulkCertSubmit = async () => {
    if (!adminProfile || !bulkCertMode || selectedRecords.length === 0) return;
    setBulkCertBusy(true);
    setError(null);
    try {
      const issued = bulkCertMode === 'issue';
      const count = await bulkIssueCertificates(
        selectedRecords,
        {
          issued,
          certificateTitle: bulkCertTitle,
          certificateNote: bulkCertNote,
        },
        adminProfile
      );
      setFeedback(
        issued
          ? `Issued official certificates to ${count} participant(s). Students can now download them in the Portal.`
          : `Revoked certificates for ${count} participant(s).`
      );
      setBulkCertMode(null);
      setBulkCertTitle('');
      setBulkCertNote('');
      clearSelection();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk certificate operation failed.');
    } finally {
      setBulkCertBusy(false);
    }
  };

  const handleRowActionConfirm = async (reason: string) => {
    if (!adminProfile || !rowAction) return;
    try {
      await updateRegistrationDetails(
        rowAction.reg,
        { registrationStatus: rowAction.nextStatus },
        reason,
        adminProfile
      );
      setFeedback(
        `Updated ${rowAction.reg.registrationReference} to "${rowAction.nextStatus}".`
      );
      setRowAction(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const handleQuickExport = async (format: 'xlsx' | 'csv') => {
    if (!adminProfile) return;
    const rows = selectedRecords.length > 0 ? selectedRecords : filtered;
    const scopeLabel =
      selectedRecords.length > 0
        ? `Selected ${selectedRecords.length} rows`
        : `All ${filtered.length} filtered records`;
    try {
      await exportRegistrations({
        format,
        scopeLabel,
        registrations: rows,
        gamesById,
        actor: adminProfile,
        filterSummary: `event=${eventFilter}, game=${gameFilter}, status=${statusFilter}`,
      });
      setFeedback(`Exported ${rows.length} record(s) as ${format.toUpperCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  return (
    <AdminLayout title="Participant Management" breadcrumb="Admin / Participants">
      <div className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
        {feedback && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm flex items-center justify-between">
            <span>{feedback}</span>
            <button type="button" onClick={() => setFeedback(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Search & Filter Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setPage(1);
                }}
                placeholder="Search student name, registration no., phone, team..."
                className="w-full pl-9 pr-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg text-sm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleQuickExport('xlsx')}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  Export Excel (
                  {selectedRecords.length > 0
                    ? `${selectedRecords.length} selected`
                    : `${filtered.length} filtered`}
                  )
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleQuickExport('csv')}
                disabled={filtered.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <select
              aria-label="Filter by event"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
            >
              <option value="all">All Events</option>
              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by game"
              value={gameFilter}
              onChange={(e) => {
                setGameFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
            >
              <option value="all">All Games</option>
              {availableGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by branch"
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
            >
              <option value="all">All Branches</option>
              {settings.branches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by year"
              value={yearFilter}
              onChange={(e) => {
                setYearFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
            >
              <option value="all">All Years</option>
              {settings.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by registration status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="waitlisted">Waitlisted</option>
              <option value="rejected">Cancelled / Ineligible</option>
              <option value="withdrawn">Withdrawn</option>
            </select>

            <select
              aria-label="Filter by competition progress"
              value={progressFilter}
              onChange={(e) => {
                setProgressFilter(e.target.value);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
            >
              <option value="all">All Match Progress</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="selected">Selected</option>
              <option value="scheduled">Match Scheduled</option>
              <option value="completed">Match Completed</option>
              <option value="winner">Winner</option>
            </select>

            <select
              aria-label="Filter by participation type"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as 'all' | ParticipationType);
                setPage(1);
              }}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
            >
              <option value="all">All Formats</option>
              <option value="individual">Individual</option>
              <option value="doubles">Doubles</option>
              <option value="team">Team / Group</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5">
                <span>From:</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="border border-slate-300 bg-white text-slate-900 rounded px-2 py-1 text-xs"
                />
              </label>
              <label className="inline-flex items-center gap-1.5">
                <span>To:</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="border border-slate-300 bg-white text-slate-900 rounded px-2 py-1 text-xs"
                />
              </label>
            </div>

            <div className="flex items-center gap-3 tabular-nums">
              <span>
                Showing {filtered.length} matching record(s)
              </span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value) as 25 | 50 | 100);
                  setPage(1);
                }}
                className="border border-slate-300 rounded px-2 py-1 text-xs bg-white text-slate-900"
              >
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
          </div>
        </div>

        {/* Selection & Bulk Action Bar */}
        {selectedRecords.length > 0 && (
          <div className="bg-[#142D50] text-white rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold tabular-nums">
                {selectedRecords.length} selected
              </span>
              {selectedRecords.length < filtered.length && (
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="underline text-[#F28C28]"
                >
                  Select all {filtered.length} matching filtered records
                </button>
              )}
              <button type="button" onClick={clearSelection} className="underline text-slate-300">
                Clear selection
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canModifyRegStatus && (
                <>
                  <button
                    type="button"
                    onClick={() => setBulkAction('approved')}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 rounded-md hover:bg-emerald-700"
                  >
                    Bulk Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkAction('waitlisted')}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#F28C28] rounded-md hover:bg-[#dc7a1b]"
                  >
                    Bulk Waitlist
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkAction('rejected')}
                    className="px-3 py-1.5 text-xs font-semibold bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Bulk Reject
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setBulkCertTitle('');
                  setBulkCertNote('');
                  setBulkCertMode('issue');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#142D50] bg-white rounded-md hover:bg-slate-100"
              >
                <Award className="w-3.5 h-3.5 text-[#F28C28]" />
                <span>Issue Certificates</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBulkCertTitle('');
                  setBulkCertNote('');
                  setBulkCertMode('revoke');
                }}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 border border-white/25 rounded-md hover:bg-white/10"
              >
                Revoke Certs
              </button>
            </div>
          </div>
        )}

        {/* Participants Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading participant records...</div>
          ) : pageItems.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No registrations match your current search or filter criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all rows on this page"
                        checked={allPageSelected}
                        onChange={toggleSelectPage}
                      />
                    </th>
                    <th className="py-3 px-3">Student / Team Leader</th>
                    <th className="py-3 px-3">Branch &amp; Year</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Event &amp; Game</th>
                    <th className="py-3 px-3">Team / Date</th>
                    <th className="py-3 px-3">Registration Status</th>
                    <th className="py-3 px-3">Match Progress</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {pageItems.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          aria-label={`Select ${r.participant.fullName}`}
                          checked={selectedIds.has(r.id)}
                          onChange={() => toggleSelectRow(r.id)}
                        />
                      </td>
                      <td className="py-3 px-3">
                        <Link
                          to={`/admin/registrations/${r.id}`}
                          className="font-semibold text-sm text-[#142D50] hover:underline block"
                        >
                          {r.participant.fullName}
                        </Link>
                        <span className="font-mono text-slate-500">
                          {r.participant.enrollmentNumber} · {r.registrationReference}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-800">{r.participant.branch}</p>
                        <p className="text-slate-500">{r.participant.year}</p>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        <p>{showFullPII ? r.participant.phone : maskPhone(r.participant.phone)}</p>
                        <p className="text-[11px] font-sans text-slate-500 truncate max-w-[160px]">
                          {r.participant.email
                            ? showFullPII
                              ? r.participant.email
                              : maskEmail(r.participant.email)
                            : '—'}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-800">{r.gameName}</p>
                        <p className="text-slate-500">{r.eventName}</p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-800">
                          {r.team.teamName || (r.participationType === 'individual' ? 'Solo' : 'Pair')}
                        </p>
                        <p className="text-slate-400 tabular-nums">{formatDate(r.createdAt)}</p>
                      </td>
                      <td className="py-3 px-3">
                        <StatusTag status={r.registrationStatus} />
                      </td>
                      <td className="py-3 px-3 space-y-1">
                        <div>
                          <StatusTag status={r.selectionStatus} />
                        </div>
                        <div>
                          <StatusTag status={r.matchStatus} />
                        </div>
                        {r.certificateIssued && (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded border bg-amber-50 text-[#142D50] border-amber-200">
                            <Award className="w-3 h-3 text-[#F28C28]" />
                            <span>Cert Issued</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            to={`/admin/registrations/${r.id}`}
                            className="p-1.5 text-slate-600 hover:text-[#142D50]"
                            title="View full registration"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          {canModifyRegStatus && r.registrationStatus !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => setRowAction({ reg: r, nextStatus: 'approved' })}
                              className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          {canModifyRegStatus && r.registrationStatus !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => setRowAction({ reg: r, nextStatus: 'rejected' })}
                              className="p-1.5 text-red-700 hover:bg-red-50 rounded"
                              title="Reject"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="tabular-nums">
                Page {safePage} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1 border border-slate-300 rounded disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(bulkAction)}
        title={`Confirm Bulk ${bulkAction ? bulkAction.toUpperCase() : ''}`}
        description={`You are about to update ${selectedRecords.length} selected registration(s) to "${bulkAction}". This action will be recorded in status history and audit logs.`}
        confirmLabel={`Apply to ${selectedRecords.length} record(s)`}
        confirmTone={bulkAction === 'rejected' ? 'danger' : 'primary'}
        onCancel={() => setBulkAction(null)}
        onConfirm={handleBulkConfirm}
      />

      <ConfirmModal
        open={Boolean(rowAction)}
        title={`Update Status to ${rowAction?.nextStatus.toUpperCase()}`}
        description={`Update ${rowAction?.reg.participant.fullName} (${rowAction?.reg.registrationReference}) to ${rowAction?.nextStatus}?`}
        confirmLabel="Update Status"
        confirmTone={rowAction?.nextStatus === 'rejected' ? 'danger' : 'primary'}
        requireReason={rowAction?.nextStatus === 'rejected'}
        onCancel={() => setRowAction(null)}
        onConfirm={handleRowActionConfirm}
      />

      {bulkCertMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-cert-title"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h2 id="bulk-cert-title" className="font-display text-lg font-bold text-[#142D50]">
              {bulkCertMode === 'issue'
                ? `Issue Certificates (${selectedRecords.length} selected)`
                : `Revoke Certificates (${selectedRecords.length} selected)`}
            </h2>
            <p className="text-xs text-slate-600">
              {bulkCertMode === 'issue'
                ? 'Unlocks high-resolution certificate download in the Student Sports Portal for all selected participants.'
                : 'Removes downloadable certificate access for the selected registrations.'}
            </p>

            {bulkCertMode === 'issue' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="bulk-cert-heading" className="block text-xs font-medium text-slate-700 mb-1">
                    Custom Certificate Heading (Optional)
                  </label>
                  <input
                    id="bulk-cert-heading"
                    type="text"
                    value={bulkCertTitle}
                    onChange={(e) => setBulkCertTitle(e.target.value)}
                    placeholder="Leave blank to auto-pick based on Winner / Runner-Up / Participant"
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-cert-note" className="block text-xs font-medium text-slate-700 mb-1">
                    Citation Note (Optional)
                  </label>
                  <textarea
                    id="bulk-cert-note"
                    rows={2}
                    value={bulkCertNote}
                    onChange={(e) => setBulkCertNote(e.target.value)}
                    placeholder="Optional common citation text..."
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-xs"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBulkCertMode(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkCertBusy}
                onClick={() => void handleBulkCertSubmit()}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-60 ${
                  bulkCertMode === 'issue'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {bulkCertBusy
                  ? 'Applying...'
                  : bulkCertMode === 'issue'
                  ? `Issue to ${selectedRecords.length} Entry(s)`
                  : `Revoke ${selectedRecords.length} Entry(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

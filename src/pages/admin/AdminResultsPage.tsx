import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Edit3, Eye, EyeOff, Plus, Trash2, Trophy } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { ConfirmModal } from '@/src/components/common/ConfirmModal';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listAllEventsForAdmin, listAllGames } from '@/src/services/firebase/events';
import { listRegistrationsForAdmin } from '@/src/services/firebase/registrations';
import {
  deletePublishedResult,
  listAllResultsForAdmin,
  savePublishedResult,
} from '@/src/services/firebase/results';
import { formatDate } from '@/src/utils/formatters';
import type {
  EventGame,
  GameCategory,
  ParticipationType,
  PublishedResult,
  Registration,
  ResultPlacement,
  SportEvent,
} from '@/src/types/models';

export function AdminResultsPage() {
  const { adminProfile } = useAuth();
  const { settings } = useSiteSettings();

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [gamesByEvent, setGamesByEvent] = useState<Record<string, EventGame[]>>({});
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [results, setResults] = useState<PublishedResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [eventFilter, setEventFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Form / Editor State
  const [editingResult, setEditingResult] = useState<PublishedResult | null>(null);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [selectedRegId, setSelectedRegId] = useState('');
  const [winnerDisplayName, setWinnerDisplayName] = useState('');
  const [branch, setBranch] = useState(settings.branches[0] || 'CSE (IoT)');
  const [year, setYear] = useState(settings.years[0] || '1st Year');
  const [placement, setPlacement] = useState<ResultPlacement>('winner');
  const [scoreOrRemark, setScoreOrRemark] = useState('');
  const [published, setPublished] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<PublishedResult | null>(null);

  const loadData = useCallback(async () => {
    if (!adminProfile) return;
    setLoading(true);
    try {
      const [evList, resList, regList] = await Promise.all([
        listAllEventsForAdmin(adminProfile),
        listAllResultsForAdmin(),
        listRegistrationsForAdmin(adminProfile),
      ]);
      setEvents(evList);
      setResults(resList);
      setRegistrations(regList);

      const gameEntries = await Promise.all(
        evList.map(async (ev) => [ev.id, await listAllGames(ev.id)] as const)
      );
      const map: Record<string, EventGame[]> = {};
      for (const [eid, gms] of gameEntries) map[eid] = gms;
      setGamesByEvent(map);

      if (!selectedEventId && evList.length > 0) {
        const firstEv = evList[0];
        setSelectedEventId(firstEv.id);
        const gms = map[firstEv.id] || [];
        if (gms.length > 0) setSelectedGameId(gms[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load results workspace.');
    } finally {
      setLoading(false);
    }
  }, [adminProfile, selectedEventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeGames = useMemo(
    () => (selectedEventId ? gamesByEvent[selectedEventId] || [] : []),
    [gamesByEvent, selectedEventId]
  );

  const matchingRegistrations = useMemo(() => {
    return registrations.filter(
      (r) =>
        (!selectedEventId || r.eventId === selectedEventId) &&
        (!selectedGameId || r.gameId === selectedGameId) &&
        r.registrationStatus !== 'rejected' &&
        r.registrationStatus !== 'cancelled'
    );
  }, [registrations, selectedEventId, selectedGameId]);

  const handleEventChange = (nextEventId: string) => {
    setSelectedEventId(nextEventId);
    const gms = gamesByEvent[nextEventId] || [];
    setSelectedGameId(gms[0]?.id || '');
    setSelectedRegId('');
  };

  const handleGameChange = (nextGameId: string) => {
    setSelectedGameId(nextGameId);
    setSelectedRegId('');
  };

  const handlePickRegistration = (regId: string) => {
    setSelectedRegId(regId);
    const reg = registrations.find((r) => r.id === regId);
    if (!reg) return;
    const displayName =
      reg.participationType === 'team' && reg.team?.teamName
        ? reg.team.teamName
        : reg.participant.fullName;
    setWinnerDisplayName(displayName);
    setBranch(reg.participant.branch);
    setYear(reg.participant.year);
    if (reg.result === 'winner' || reg.result === 'runner_up' || reg.result === 'participant') {
      setPlacement(reg.result);
    }
  };

  const resetForm = () => {
    setEditingResult(null);
    setSelectedRegId('');
    setWinnerDisplayName('');
    setPlacement('winner');
    setScoreOrRemark('');
    setPublished(true);
    setBranch(settings.branches[0] || 'CSE (IoT)');
    setYear(settings.years[0] || '1st Year');
  };

  const handleEditClick = (item: PublishedResult) => {
    setEditingResult(item);
    setSelectedEventId(item.eventId);
    setSelectedGameId(item.gameId);
    setSelectedRegId(item.registrationId || '');
    setWinnerDisplayName(item.winnerDisplayName);
    setBranch(item.branch);
    setYear(item.year);
    setPlacement(item.placement);
    setScoreOrRemark(item.scoreOrRemark);
    setPublished(item.published);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile) return;
    const ev = events.find((item) => item.id === selectedEventId);
    const gm = activeGames.find((item) => item.id === selectedGameId);
    if (!ev || !gm) {
      setError('Select a valid event and game first.');
      return;
    }
    if (winnerDisplayName.trim().length < 2) {
      setError('Enter the winner or team display name.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await savePublishedResult(
        {
          eventId: ev.id,
          eventName: ev.name,
          gameId: gm.id,
          gameName: gm.name,
          category: gm.category as GameCategory,
          participationType: gm.participationType as ParticipationType,
          winnerDisplayName: winnerDisplayName.trim(),
          branch: branch.trim(),
          year: year.trim(),
          placement,
          scoreOrRemark: scoreOrRemark.trim(),
          registrationId: selectedRegId,
          published,
        },
        adminProfile,
        editingResult
      );
      setNotice(
        editingResult
          ? `Updated result for ${winnerDisplayName.trim()}.`
          : `Saved result for ${winnerDisplayName.trim()} (${gm.name}).`
      );
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save result.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublished = async (item: PublishedResult) => {
    if (!adminProfile) return;
    setError(null);
    try {
      await savePublishedResult(
        {
          eventId: item.eventId,
          eventName: item.eventName,
          gameId: item.gameId,
          gameName: item.gameName,
          category: item.category,
          participationType: item.participationType,
          winnerDisplayName: item.winnerDisplayName,
          branch: item.branch,
          year: item.year,
          placement: item.placement,
          scoreOrRemark: item.scoreOrRemark,
          registrationId: item.registrationId,
          published: !item.published,
        },
        adminProfile,
        item
      );
      setNotice(
        `${item.winnerDisplayName} (${item.gameName}) is now ${!item.published ? 'Published' : 'Hidden'}.`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to toggle visibility.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!adminProfile || !deleteTarget) return;
    try {
      await deletePublishedResult(deleteTarget, adminProfile);
      setNotice(`Removed result for ${deleteTarget.winnerDisplayName}.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete result.');
    }
  };

  const allowedEventIds = useMemo(() => new Set(events.map((e) => e.id)), [events]);

  const filteredResults = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return results.filter((r) => {
      if (adminProfile?.role !== 'super_admin' && !allowedEventIds.has(r.eventId)) return false;
      if (eventFilter !== 'all' && r.eventId !== eventFilter) return false;
      if (needle) {
        const hay = `${r.winnerDisplayName} ${r.gameName} ${r.eventName} ${r.branch} ${r.scoreOrRemark}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [results, adminProfile?.role, allowedEventIds, eventFilter, searchTerm]);

  const canDeleteResult = (eventId: string) =>
    adminProfile?.role === 'super_admin' ||
    (adminProfile?.role === 'event_admin' && adminProfile.assignedEventIds.includes(eventId));

  return (
    <AdminLayout title="Tournament Results Panel" breadcrumb="Admin / Results">
      <div className="space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm flex items-center justify-between">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Publish / Edit Result Form */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-[#F28C28]" />
              <h2 className="font-display text-lg font-bold text-[#142D50]">
                {editingResult ? 'Edit Published Result' : 'Publish New Podium Result'}
              </h2>
            </div>
            {editingResult && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-slate-600 underline hover:text-[#142D50]"
              >
                Cancel Editing
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="res-event" className="block text-xs font-medium text-slate-700 mb-1">
                Event *
              </label>
              <select
                id="res-event"
                required
                value={selectedEventId}
                onChange={(e) => handleEventChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                <option value="">Select event...</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="res-game" className="block text-xs font-medium text-slate-700 mb-1">
                Game / Sport *
              </label>
              <select
                id="res-game"
                required
                value={selectedGameId}
                onChange={(e) => handleGameChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                <option value="">Select game...</option>
                {activeGames.map((gm) => (
                  <option key={gm.id} value={gm.id}>
                    {gm.name} ({gm.participationType})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="res-reg-pick" className="block text-xs font-medium text-slate-700 mb-1">
                Optional: Auto-fill from Participant
              </label>
              <select
                id="res-reg-pick"
                value={selectedRegId}
                onChange={(e) => handlePickRegistration(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                <option value="">Manual entry or choose participant...</option>
                {matchingRegistrations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.team?.teamName ? `${r.team.teamName} (${r.participant.fullName})` : r.participant.fullName} —{' '}
                    {r.participant.enrollmentNumber}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label htmlFor="res-winner" className="block text-xs font-medium text-slate-700 mb-1">
                Winner / Team Display Name *
              </label>
              <input
                id="res-winner"
                type="text"
                required
                value={winnerDisplayName}
                onChange={(e) => setWinnerDisplayName(e.target.value)}
                placeholder="e.g. CSE IoT Strikers or Aarav Kumar"
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="res-placement" className="block text-xs font-medium text-slate-700 mb-1">
                Placement *
              </label>
              <select
                id="res-placement"
                value={placement}
                onChange={(e) => setPlacement(e.target.value as ResultPlacement)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                <option value="winner">Winner (1st Place)</option>
                <option value="runner_up">Runner-Up (2nd Place)</option>
                <option value="third_place">3rd Place</option>
                <option value="finalist">Finalist</option>
                <option value="participant">Special Mention / Participant</option>
              </select>
            </div>

            <div>
              <label htmlFor="res-branch" className="block text-xs font-medium text-slate-700 mb-1">
                Department / Branch
              </label>
              <select
                id="res-branch"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                <option value="Open / Inter-Branch">Open / Inter-Branch</option>
                {settings.branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="res-year" className="block text-xs font-medium text-slate-700 mb-1">
                Year
              </label>
              <select
                id="res-year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                <option value="All Years">All Years</option>
                {settings.years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="res-score" className="block text-xs font-medium text-slate-700 mb-1">
                Scoreline / Timing / Remark
              </label>
              <input
                id="res-score"
                type="text"
                value={scoreOrRemark}
                onChange={(e) => setScoreOrRemark(e.target.value)}
                placeholder="e.g. Won Final by 18 runs · Man of the Match"
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              <span>Publish immediately to Homepage & Public Results Panel</span>
            </label>

            <button
              type="submit"
              disabled={saving || events.length === 0 || activeGames.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-60"
            >
              {editingResult ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{saving ? 'Saving...' : editingResult ? 'Update Result' : 'Save & Publish Result'}</span>
            </button>
          </div>
        </form>

        {/* Results Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-[#F28C28]" />
              <h3 className="font-display text-base font-bold text-[#142D50]">
                Published & Draft Results ({filteredResults.length})
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search winner, game..."
                className="px-3 py-1.5 border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 rounded-lg text-xs"
              />
              <select
                aria-label="Filter results by event"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-900"
              >
                <option value="all">All Events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading tournament results...</div>
          ) : filteredResults.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No results recorded yet. Use the form above to publish champions and medalists.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-3 px-4">Event & Game</th>
                    <th className="py-3 px-4">Winner / Team</th>
                    <th className="py-3 px-4">Branch & Year</th>
                    <th className="py-3 px-4">Placement</th>
                    <th className="py-3 px-4">Score / Remark</th>
                    <th className="py-3 px-4">Visibility</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredResults.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#142D50]">{item.gameName}</p>
                        <p className="text-slate-500">
                          {item.eventName} · {item.category}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#0F1E33]">
                        {item.winnerDisplayName}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {item.branch} · {item.year}
                      </td>
                      <td className="py-3 px-4">
                        <StatusTag status={item.placement} />
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {item.scoreOrRemark || '—'}
                        <p className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                          {formatDate(item.updatedAt)}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => void handleTogglePublished(item)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border font-medium ${
                            item.published
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {item.published ? (
                            <>
                              <Eye className="w-3 h-3" />
                              <span>Public</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              <span>Hidden</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditClick(item)}
                            className="p-1.5 text-slate-600 hover:text-[#142D50]"
                            title="Edit result"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          {canDeleteResult(item.eventId) && (
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Delete result"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Published Result"
        description={`Remove the result entry for "${deleteTarget?.winnerDisplayName}" (${deleteTarget?.gameName}) from the Results Panel?`}
        confirmLabel="Delete Result"
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </AdminLayout>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CheckCircle2,
  Edit,
  ExternalLink,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { ConfirmModal } from '@/src/components/common/ConfirmModal';
import { useAuth } from '@/src/app/AuthContext';
import {
  deleteGame,
  getEventById,
  listAllGames,
  saveGame,
  saveMultipleGamesBatch,
} from '@/src/services/firebase/events';
import { formatDateTime } from '@/src/utils/formatters';
import type {
  EventGame,
  GameCategory,
  GameRegistrationStatus,
  ParticipationType,
  SportEvent,
} from '@/src/types/models';

interface BatchGameDraft {
  key: string;
  name: string;
  category: GameCategory;
  participationType: ParticipationType;
  minTeamSize: number;
  maxTeamSize: number;
}

const SPORT_PRESETS: Array<Omit<BatchGameDraft, 'key'>> = [
  { name: 'Cricket', category: 'Outdoor', participationType: 'team', minTeamSize: 11, maxTeamSize: 15 },
  { name: 'Volleyball', category: 'Outdoor', participationType: 'team', minTeamSize: 6, maxTeamSize: 12 },
  { name: 'Kabaddi', category: 'Outdoor', participationType: 'team', minTeamSize: 7, maxTeamSize: 12 },
  { name: 'Football', category: 'Outdoor', participationType: 'team', minTeamSize: 11, maxTeamSize: 15 },
  { name: 'Badminton (Singles)', category: 'Indoor', participationType: 'individual', minTeamSize: 1, maxTeamSize: 1 },
  { name: 'Badminton (Doubles)', category: 'Indoor', participationType: 'doubles', minTeamSize: 2, maxTeamSize: 2 },
  { name: 'Chess', category: 'Indoor', participationType: 'individual', minTeamSize: 1, maxTeamSize: 1 },
  { name: 'Table Tennis', category: 'Indoor', participationType: 'individual', minTeamSize: 1, maxTeamSize: 1 },
  { name: 'Carrom', category: 'Indoor', participationType: 'doubles', minTeamSize: 2, maxTeamSize: 2 },
  { name: 'Athletics 100m', category: 'Athletics', participationType: 'individual', minTeamSize: 1, maxTeamSize: 1 },
  { name: 'Relay Race (4x100m)', category: 'Athletics', participationType: 'team', minTeamSize: 4, maxTeamSize: 4 },
  { name: 'Tug of War', category: 'Outdoor', participationType: 'team', minTeamSize: 8, maxTeamSize: 10 },
];

export function AdminGamesPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { adminProfile } = useAuth();
  const [event, setEvent] = useState<SportEvent | null>(null);
  const [games, setGames] = useState<EventGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventGame | null>(null);

  // Batch Multi-Game Quick Builder
  const [showBatchBuilder, setShowBatchBuilder] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState<BatchGameDraft[]>([]);
  const [savingBatch, setSavingBatch] = useState(false);

  const loadData = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const [evt, gmList] = await Promise.all([getEventById(eventId), listAllGames(eventId)]);
      setEvent(evt);
      setGames(gmList);
      if (gmList.length === 0) {
        setShowBatchBuilder(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load games.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleStatus = async (game: EventGame, nextStatus: GameRegistrationStatus) => {
    if (!adminProfile || !eventId) return;
    try {
      await saveGame(
        {
          id: game.id,
          eventId,
          name: game.name,
          category: game.category,
          participationType: game.participationType,
          description: game.description,
          rules: game.rules,
          maxParticipants: game.maxParticipants,
          maxTeams: game.maxTeams,
          minTeamSize: game.minTeamSize,
          maxTeamSize: game.maxTeamSize,
          registrationDeadline: game.registrationDeadline.toDate(),
          registrationStatus: nextStatus,
          eligibility: game.eligibility,
          sortOrder: game.sortOrder,
          customFields: game.customFields,
        },
        adminProfile
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update game status.');
    }
  };

  const handleReorder = async (idx: number, direction: -1 | 1) => {
    if (!adminProfile || !eventId) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= games.length) return;
    const current = games[idx];
    const target = games[swapIdx];
    try {
      await Promise.all([
        saveGame(
          {
            id: current.id,
            eventId,
            name: current.name,
            category: current.category,
            participationType: current.participationType,
            description: current.description,
            rules: current.rules,
            maxParticipants: current.maxParticipants,
            maxTeams: current.maxTeams,
            minTeamSize: current.minTeamSize,
            maxTeamSize: current.maxTeamSize,
            registrationDeadline: current.registrationDeadline.toDate(),
            registrationStatus: current.registrationStatus,
            eligibility: current.eligibility,
            sortOrder: target.sortOrder === current.sortOrder ? swapIdx : target.sortOrder,
            customFields: current.customFields,
          },
          adminProfile
        ),
        saveGame(
          {
            id: target.id,
            eventId,
            name: target.name,
            category: target.category,
            participationType: target.participationType,
            description: target.description,
            rules: target.rules,
            maxParticipants: target.maxParticipants,
            maxTeams: target.maxTeams,
            minTeamSize: target.minTeamSize,
            maxTeamSize: target.maxTeamSize,
            registrationDeadline: target.registrationDeadline.toDate(),
            registrationStatus: target.registrationStatus,
            eligibility: target.eligibility,
            sortOrder: target.sortOrder === current.sortOrder ? idx : current.sortOrder,
            customFields: target.customFields,
          },
          adminProfile
        ),
      ]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder games.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !adminProfile || !eventId) return;
    try {
      await deleteGame(eventId, deleteTarget, adminProfile);
      setNotice(`Removed "${deleteTarget.name}" from this event.`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete game.');
    }
  };

  const handleAddPresetToBatch = (preset: Omit<BatchGameDraft, 'key'>) => {
    setBatchDrafts((prev) => [
      ...prev,
      {
        ...preset,
        key: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      },
    ]);
    setShowBatchBuilder(true);
  };

  const handleAddBlankBatchRow = () => {
    setBatchDrafts((prev) => [
      ...prev,
      {
        key: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: '',
        category: 'Outdoor',
        participationType: 'team',
        minTeamSize: 5,
        maxTeamSize: 12,
      },
    ]);
  };

  const handleUpdateBatchRow = (key: string, patch: Partial<BatchGameDraft>) => {
    setBatchDrafts((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.participationType === 'individual') {
          next.minTeamSize = 1;
          next.maxTeamSize = 1;
        } else if (patch.participationType === 'doubles') {
          next.minTeamSize = 2;
          next.maxTeamSize = 2;
        } else if (patch.participationType === 'team' && next.maxTeamSize < 2) {
          next.minTeamSize = 5;
          next.maxTeamSize = 12;
        }
        return next;
      })
    );
  };

  const handleRemoveBatchRow = (key: string) => {
    setBatchDrafts((prev) => prev.filter((row) => row.key !== key));
  };

  const handleSaveBatch = async () => {
    if (!adminProfile || !eventId) return;
    const validRows = batchDrafts.filter((r) => r.name.trim().length >= 2);
    if (validRows.length === 0) {
      setError('Add at least one game with a name before saving.');
      return;
    }
    setError(null);
    setNotice(null);
    setSavingBatch(true);
    try {
      const baseSort = games.length + 1;
      const defaultDeadline = event?.registrationEndAt?.toDate
        ? event.registrationEndAt.toDate()
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const count = await saveMultipleGamesBatch(
        eventId,
        validRows.map((row, idx) => {
          const minSize =
            row.participationType === 'individual'
              ? 1
              : row.participationType === 'doubles'
              ? 2
              : Math.max(1, Number(row.minTeamSize) || 1);
          const maxSize =
            row.participationType === 'individual'
              ? 1
              : row.participationType === 'doubles'
              ? 2
              : Math.max(minSize, Number(row.maxTeamSize) || minSize);

          return {
            name: row.name.trim(),
            category: row.category,
            participationType: row.participationType,
            description:
              row.participationType === 'team'
                ? `${row.name.trim()} tournament (${minSize}–${maxSize} players per team).`
                : row.participationType === 'doubles'
                ? `${row.name.trim()} doubles competition (2 players per pair).`
                : `${row.name.trim()} individual competition.`,
            rules: 'Standard GEC Khagaria Sports Club inter-branch competition rules apply.',
            maxParticipants: 0,
            maxTeams: 0,
            minTeamSize: minSize,
            maxTeamSize: maxSize,
            registrationDeadline: defaultDeadline,
            registrationStatus: 'open',
            eligibility: 'Open to all regular students of GEC Khagaria',
            sortOrder: baseSort + idx,
            customFields: [],
          };
        }),
        adminProfile
      );

      setBatchDrafts([]);
      setShowBatchBuilder(false);
      setNotice(`Added ${count} game(s) to ${event?.name || 'this event'} with registration open.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save games.');
    } finally {
      setSavingBatch(false);
    }
  };

  return (
    <AdminLayout
      title={event ? `${event.name} — Games List` : 'Event Games'}
      breadcrumb="Admin / Events / Games"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            to="/admin/events"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#142D50]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Events</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            {event && (
              <Link
                to={`/admin/events/${event.id}/edit`}
                className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Edit Event Details
              </Link>
            )}
            <button
              type="button"
              onClick={() => setShowBatchBuilder((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#142D50] bg-[#F28C28] rounded-lg hover:bg-[#f79d42]"
            >
              <Layers className="w-4 h-4" />
              <span>{showBatchBuilder ? 'Hide Quick Multi-Game Add' : 'Quick Add Multiple Games'}</span>
            </button>
            <Link
              to={`/admin/events/${eventId}/games/new`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e]"
            >
              <Plus className="w-4 h-4" />
              <span>Add One Custom Game</span>
            </Link>
          </div>
        </div>

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

        {/* Quick Multi-Game Batch Add Panel */}
        {showBatchBuilder && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#142D50]">
                  Quick Add Multiple Games to {event?.name || 'Event'}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Click any sports below (like Cricket, Volleyball, Kabaddi) to add them together,
                  set Individual vs Group/Team player limits, and save all at once.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddBlankBatchRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#142D50] border border-slate-300 bg-white rounded-lg hover:bg-slate-50 self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Custom Row</span>
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">
                One-Click Popular College Games:
              </p>
              <div className="flex flex-wrap gap-2">
                {SPORT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleAddPresetToBatch(preset)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#142D50] bg-slate-100 border border-slate-300 rounded-lg hover:bg-[#142D50] hover:text-white transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {batchDrafts.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-slate-600 px-1 hidden sm:grid">
                  <div className="col-span-4">Game Name</div>
                  <div className="col-span-2">Category</div>
                  <div className="col-span-3">Game Format</div>
                  <div className="col-span-1">Min</div>
                  <div className="col-span-1">Max</div>
                  <div className="col-span-1 text-right">Remove</div>
                </div>

                {batchDrafts.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => handleUpdateBatchRow(row.key, { name: e.target.value })}
                        placeholder="Game name (e.g. Cricket)"
                        className="w-full rounded-md border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-2.5 py-1.5 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <select
                        value={row.category}
                        onChange={(e) =>
                          handleUpdateBatchRow(row.key, {
                            category: e.target.value as GameCategory,
                          })
                        }
                        className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-2 py-1.5 text-xs"
                      >
                        <option value="Outdoor">Outdoor</option>
                        <option value="Indoor">Indoor</option>
                        <option value="Athletics">Athletics</option>
                        <option value="Esports">Esports</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        value={row.participationType}
                        onChange={(e) =>
                          handleUpdateBatchRow(row.key, {
                            participationType: e.target.value as ParticipationType,
                          })
                        }
                        className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-2 py-1.5 text-xs"
                      >
                        <option value="individual">Individual (1 Player)</option>
                        <option value="doubles">Doubles (2 Players)</option>
                        <option value="team">Group / Team Event</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        disabled={row.participationType !== 'team'}
                        value={row.minTeamSize}
                        onChange={(e) =>
                          handleUpdateBatchRow(row.key, { minTeamSize: Number(e.target.value) })
                        }
                        title="Minimum players in team"
                        className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-2 py-1.5 text-xs font-mono disabled:opacity-50"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <input
                        type="number"
                        min={1}
                        max={30}
                        disabled={row.participationType !== 'team'}
                        value={row.maxTeamSize}
                        onChange={(e) =>
                          handleUpdateBatchRow(row.key, { maxTeamSize: Number(e.target.value) })
                        }
                        title="Maximum players in team"
                        className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-2 py-1.5 text-xs font-mono disabled:opacity-50"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveBatchRow(row.key)}
                        className="p-1.5 text-red-600 hover:text-red-800"
                        title="Remove row"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBatchDrafts([])}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Clear List
                  </button>
                  <button
                    type="button"
                    disabled={savingBatch}
                    onClick={() => void handleSaveBatch()}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-60"
                  >
                    <CheckCircle2 className="w-4 h-4 text-[#F28C28]" />
                    <span>
                      {savingBatch
                        ? 'Adding Games...'
                        : `Save All ${batchDrafts.length} Game(s) to Event`}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="h-64 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : games.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <p className="font-semibold text-[#142D50]">No games added to this event yet</p>
            <p className="mt-1 text-sm text-slate-600">
              Use the quick buttons above to add Cricket, Volleyball, Kabaddi, Chess, or create a
              custom game.
            </p>
            <Link
              to={`/admin/events/${eventId}/games/new`}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Game</span>
            </Link>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Order</th>
                    <th className="py-3 px-4">Game Name</th>
                    <th className="py-3 px-4">Format &amp; Players Limit</th>
                    <th className="py-3 px-4">Extra Form Fields</th>
                    <th className="py-3 px-4">Registration Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {games.map((g, idx) => (
                    <tr key={g.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => void handleReorder(idx, -1)}
                            className="p-1 text-slate-400 hover:text-[#142D50] disabled:opacity-30"
                            aria-label={`Move ${g.name} up`}
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === games.length - 1}
                            onClick={() => void handleReorder(idx, 1)}
                            className="p-1 text-slate-400 hover:text-[#142D50] disabled:opacity-30"
                            aria-label={`Move ${g.name} down`}
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-[#142D50]">{g.name}</p>
                        <p className="text-xs text-slate-500">
                          {g.category} · Closes {formatDateTime(g.registrationDeadline)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 tabular-nums">
                        <p className="font-medium">
                          {g.participationType === 'team'
                            ? `Team / Group (${g.minTeamSize}–${g.maxTeamSize} players)`
                            : g.participationType === 'doubles'
                            ? 'Doubles (2 players)'
                            : 'Individual (1 player)'}
                        </p>
                        <p className="text-slate-500">
                          Max Entries:{' '}
                          {g.participationType === 'individual'
                            ? g.maxParticipants || 'Unlimited'
                            : g.maxTeams || 'Unlimited'}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                        {g.customFields.length} extra question(s)
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <StatusTag status={g.registrationStatus} />
                          <select
                            aria-label={`Change registration status for ${g.name}`}
                            value={g.registrationStatus}
                            onChange={(e) =>
                              void handleToggleStatus(
                                g,
                                e.target.value as GameRegistrationStatus
                              )
                            }
                            className="text-xs border border-slate-300 rounded px-2 py-1 bg-white text-slate-900"
                          >
                            <option value="draft">Draft (Hidden)</option>
                            <option value="open">Open</option>
                            <option value="closed">Closed</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            to={`/admin/events/${eventId}/games/${g.id}/edit`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#142D50] bg-slate-100 rounded-md hover:bg-slate-200"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit Game</span>
                          </Link>
                          <Link
                            to={`/register/${eventId}/${g.id}`}
                            className="p-1.5 text-slate-600 hover:text-[#142D50]"
                            title="Preview registration form"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(g)}
                            className="p-1.5 text-red-600 hover:text-red-800"
                            title="Remove game from event"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Remove Game from Event"
        description={`Remove "${deleteTarget?.name}" from this event? Existing registrations already submitted will stay archived in records.`}
        confirmLabel="Remove Game"
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </AdminLayout>
  );
}

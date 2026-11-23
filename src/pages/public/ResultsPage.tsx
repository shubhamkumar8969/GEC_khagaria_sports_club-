import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Medal, Search, Trophy } from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listPublicEvents } from '@/src/services/firebase/events';
import { listPublicResults } from '@/src/services/firebase/results';
import { formatDate } from '@/src/utils/formatters';
import type { GameCategory, PublishedResult, ResultPlacement, SportEvent } from '@/src/types/models';

const PLACEMENT_RANK: Record<ResultPlacement, number> = {
  winner: 1,
  runner_up: 2,
  third_place: 3,
  finalist: 4,
  participant: 5,
};

export function ResultsPage() {
  const { settings } = useSiteSettings();
  const [results, setResults] = useState<PublishedResult[]>([]);
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventFilter, setEventFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | GameCategory>('all');
  const [placementFilter, setPlacementFilter] = useState<'all' | ResultPlacement>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [resList, evList] = await Promise.all([
          listPublicResults(),
          listPublicEvents(),
        ]);
        if (!active) return;
        setResults(resList);
        setEvents(evList);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load published results.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const visibleEventIds = useMemo(() => {
    const map = new Map<string, SportEvent>();
    for (const ev of events) {
      map.set(ev.id, ev);
    }
    return map;
  }, [events]);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return results
      .filter((r) => {
        const parentEvent = visibleEventIds.get(r.eventId);
        if (parentEvent && !parentEvent.showPublicResults && !settings.showPublicResults) {
          return false;
        }
        if (eventFilter !== 'all' && r.eventId !== eventFilter) return false;
        if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
        if (placementFilter !== 'all' && r.placement !== placementFilter) return false;
        if (needle) {
          const hay = `${r.winnerDisplayName} ${r.gameName} ${r.eventName} ${r.branch} ${r.scoreOrRemark}`.toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => (PLACEMENT_RANK[a.placement] || 9) - (PLACEMENT_RANK[b.placement] || 9));
  }, [results, visibleEventIds, settings.showPublicResults, eventFilter, categoryFilter, placementFilter, searchTerm]);

  const podiumHighlights = useMemo(
    () =>
      filtered
        .filter((r) => r.placement === 'winner' || r.placement === 'runner_up' || r.placement === 'third_place')
        .slice(0, 6),
    [filtered]
  );

  return (
    <PublicLayout>
      <section className="bg-subpage-arena text-white py-12 border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              {settings.clubName}
            </p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold">
              Official Tournament Results Panel
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              Verified champions, runners-up, and match outcomes published by the Sports Club committee.
            </p>
          </div>
          <Link
            to="/student"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg btn-3d-red whitespace-nowrap shrink-0"
          >
            <Award className="w-4 h-4" />
            <span>Student Dashboard &amp; Certificates</span>
          </Link>
        </div>
      </section>

      <section className="bg-results-tint min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          {error && (
            <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          {/* Filter Bar */}
          <div className="card-3d rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-blue-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search winner, team, game, branch..."
                className="w-full pl-9 pr-3 py-2 bg-[#080B14] border border-blue-500/30 rounded-lg text-sm text-white placeholder-slate-400 focus:border-red-400 focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter results by event"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-3 py-2 bg-[#080B14] border border-blue-500/30 rounded-lg text-sm text-white focus:border-red-400 focus:outline-none"
            >
              <option value="all" className="bg-[#0B101D] text-white">All Events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id} className="bg-[#0B101D] text-white">
                  {ev.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter results by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'all' | GameCategory)}
              className="px-3 py-2 bg-[#080B14] border border-blue-500/30 rounded-lg text-sm text-white focus:border-red-400 focus:outline-none"
            >
              <option value="all" className="bg-[#0B101D] text-white">All Sport Categories</option>
              <option value="Outdoor" className="bg-[#0B101D] text-white">Outdoor</option>
              <option value="Indoor" className="bg-[#0B101D] text-white">Indoor</option>
              <option value="Athletics" className="bg-[#0B101D] text-white">Athletics</option>
              <option value="Esports" className="bg-[#0B101D] text-white">Esports</option>
              <option value="Other" className="bg-[#0B101D] text-white">Other</option>
            </select>

            <select
              aria-label="Filter results by placement"
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value as 'all' | ResultPlacement)}
              className="px-3 py-2 bg-[#080B14] border border-blue-500/30 rounded-lg text-sm text-white focus:border-red-400 focus:outline-none"
            >
              <option value="all" className="bg-[#0B101D] text-white">All Placements</option>
              <option value="winner" className="bg-[#0B101D] text-white">Winners (1st)</option>
              <option value="runner_up" className="bg-[#0B101D] text-white">Runners-Up (2nd)</option>
              <option value="third_place" className="bg-[#0B101D] text-white">3rd Place</option>
              <option value="finalist" className="bg-[#0B101D] text-white">Finalists</option>
              <option value="participant" className="bg-[#0B101D] text-white">Participants</option>
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 card-3d rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-3d rounded-2xl p-12 text-center space-y-3">
              <Trophy className="w-8 h-8 text-red-400 mx-auto" />
              <h2 className="font-display text-xl font-bold text-white">
                No Published Results Match Your Filter
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Tournament results are published here once matches conclude and club administrators verify standings.
              </p>
            </div>
          ) : (
            <>
              {podiumHighlights.length > 0 && (
                <div className="space-y-4">
                  <h2 className="font-display text-xl font-bold text-white">
                    Podium Champions &amp; Medalists
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {podiumHighlights.map((res) => {
                      const isWinner = res.placement === 'winner';
                      const isRunner = res.placement === 'runner_up';
                      const cardTone = isWinner
                        ? 'card-3d-red card-3d-hover'
                        : isRunner
                        ? 'card-3d-blue card-3d-hover'
                        : 'card-3d card-3d-hover';
                      return (
                        <article
                          key={res.id}
                          className={`rounded-2xl p-6 flex flex-col justify-between ${cardTone}`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-3">
                              <span className="text-xs font-medium text-slate-300 truncate">
                                {res.eventName} · {res.category}
                              </span>
                              <StatusTag status={res.placement} />
                            </div>

                            <div className="flex items-start gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                                  isWinner
                                    ? 'bg-gradient-to-br from-[#EF4444] to-[#B91C1C] text-white'
                                    : isRunner
                                    ? 'bg-gradient-to-br from-[#3B82F6] to-[#1D4ED8] text-white'
                                    : 'bg-gradient-to-br from-[#DC2626] to-[#1D4ED8] text-white'
                                }`}
                              >
                                {isWinner ? (
                                  <Trophy className="w-5 h-5" />
                                ) : (
                                  <Medal className="w-5 h-5" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-red-400">{res.gameName}</p>
                                <h3 className="font-display text-lg font-bold text-white truncate">
                                  {res.winnerDisplayName}
                                </h3>
                                <p className="text-xs text-blue-200/80 mt-0.5">
                                  {res.branch} · {res.year}
                                </p>
                              </div>
                            </div>
                          </div>

                          {res.scoreOrRemark && (
                            <p className="mt-4 pt-3 border-t border-white/10 text-xs font-medium text-slate-200">
                              {res.scoreOrRemark}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Complete Standings Ledger */}
              <div className="card-3d rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-[#080B14]/70">
                  <h2 className="font-display text-lg font-bold text-white">
                    Complete Standings &amp; Match Outcomes
                  </h2>
                  <span className="text-xs text-blue-300 tabular-nums">
                    {filtered.length} published {filtered.length === 1 ? 'record' : 'records'}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-[#080B14] border-b border-blue-500/25 text-xs font-semibold text-blue-200">
                        <th className="py-3 px-4">Event &amp; Discipline</th>
                        <th className="py-3 px-4">Winner / Team</th>
                        <th className="py-3 px-4">Branch &amp; Year</th>
                        <th className="py-3 px-4">Placement</th>
                        <th className="py-3 px-4">Score / Remark</th>
                        <th className="py-3 px-4">Updated</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {filtered.map((r) => (
                        <tr key={r.id} className="hover:bg-blue-950/35 transition-colors">
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-white">{r.gameName}</p>
                            <p className="text-xs text-slate-400">
                              {r.eventName} · {r.category}
                            </p>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-100">
                            {r.winnerDisplayName}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-300">
                            {r.branch} · {r.year}
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusTag status={r.placement} />
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-200">
                            {r.scoreOrRemark || '—'}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-400 tabular-nums">
                            {formatDate(r.updatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Calendar, ShieldCheck, Users } from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { getEventById, getGameById, getGameCounterCount } from '@/src/services/firebase/events';
import { formatDateTime } from '@/src/utils/formatters';
import type { EventGame, SportEvent } from '@/src/types/models';

export function GameDetailPage() {
  const { eventId, gameId } = useParams<{ eventId: string; gameId: string }>();
  const [event, setEvent] = useState<SportEvent | null>(null);
  const [game, setGame] = useState<EventGame | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !gameId) return;
    let active = true;
    async function load() {
      try {
        const [evt, gm, count] = await Promise.all([
          getEventById(eventId!),
          getGameById(eventId!, gameId!),
          getGameCounterCount(eventId!, gameId!),
        ]);
        if (!active) return;
        setEvent(evt);
        setGame(gm);
        setEntryCount(count);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load game details.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventId, gameId]);

  const maxCap =
    game?.participationType === 'individual' ? game.maxParticipants : game?.maxTeams ?? 0;
  const capacityReached = maxCap > 0 && entryCount >= maxCap;
  const isOpen =
    event?.status === 'registration_open' &&
    game?.registrationStatus === 'open' &&
    !capacityReached;

  return (
    <PublicLayout>
      <section className="bg-campus-tint min-h-[75vh]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to={eventId ? `/events/${eventId}` : '/events'}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-300 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {event?.name || 'Event'}</span>
          </Link>

          {loading ? (
            <div className="h-80 card-3d rounded-2xl animate-pulse" />
          ) : error ? (
            <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-6 text-sm">
              {error}
            </div>
          ) : !event || !game ? (
            <div className="card-3d rounded-2xl p-10 text-center">
              <h1 className="font-display text-xl font-bold text-white">Game Not Found</h1>
            </div>
          ) : (
            <div className="card-3d rounded-2xl p-6 sm:p-8 space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-white/10">
                <div>
                  <p className="text-xs font-medium text-blue-300">
                    {event.name} · {game.category}
                  </p>
                  <h1 className="mt-1 font-display text-3xl font-bold text-white">{game.name}</h1>
                  <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                    {game.description}
                  </p>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
                  <StatusTag status={game.registrationStatus} />
                  {isOpen ? (
                    <Link
                      to={`/register/${event.id}/${game.id}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl btn-3d-red whitespace-nowrap shrink-0"
                    >
                      <span>Register Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <span className="text-xs font-medium text-red-400">
                      {capacityReached ? 'Capacity Full' : 'Registration Closed'}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="p-4 bg-[#080C17] rounded-xl border border-blue-500/30">
                  <div className="flex items-center gap-2 text-xs text-blue-300 mb-1">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>Participation Format</span>
                  </div>
                  <p className="text-sm font-semibold text-white">
                    {game.participationType === 'team'
                      ? `Team / Group (${game.minTeamSize}–${game.maxTeamSize} players)`
                      : game.participationType === 'doubles'
                      ? 'Doubles (2 players)'
                      : 'Individual (1 player)'}
                  </p>
                </div>

                <div className="p-4 bg-[#080C17] rounded-xl border border-red-500/30">
                  <div className="flex items-center gap-2 text-xs text-red-300 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-red-400" />
                    <span>Registration Deadline</span>
                  </div>
                  <p className="text-sm font-semibold text-white tabular-nums">
                    {formatDateTime(game.registrationDeadline)}
                  </p>
                </div>

                <div className="p-4 bg-[#080C17] rounded-xl border border-blue-500/30">
                  <div className="flex items-center gap-2 text-xs text-blue-300 mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    <span>Entry Capacity</span>
                  </div>
                  <p className="text-sm font-semibold text-white tabular-nums">
                    {maxCap > 0 ? `${entryCount} / ${maxCap} registered` : `${entryCount} registered (No cap)`}
                  </p>
                </div>
              </div>

              {game.eligibility && (
                <div>
                  <h2 className="font-display text-lg font-bold text-white">Eligibility</h2>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed">{game.eligibility}</p>
                </div>
              )}

              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  Competition Rules &amp; Guidelines
                </h2>
                <div className="mt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                  {game.rules || 'Standard college sports tournament rules apply.'}
                </div>
              </div>

              {game.customFields.length > 0 && (
                <div className="pt-4 border-t border-white/10">
                  <h2 className="font-display text-base font-bold text-white">
                    Additional Information Requested on Form
                  </h2>
                  <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
                    {game.customFields.map((f) => (
                      <li key={f.id}>
                        • {f.label} {f.required ? '(Required)' : '(Optional)'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

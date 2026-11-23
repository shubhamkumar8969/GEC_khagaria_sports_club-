import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  Clock,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { SportBannerGraphic } from '@/src/components/common/SportBannerGraphic';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { getEventById, listPublicGames } from '@/src/services/firebase/events';
import { listPublicEventPhotos } from '@/src/services/firebase/photos';
import { formatDate, formatDateTime } from '@/src/utils/formatters';
import type { EventGame, EventPhoto, SportEvent } from '@/src/types/models';

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<SportEvent | null>(null);
  const [games, setGames] = useState<EventGame[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [lightboxPhoto, setLightboxPhoto] = useState<EventPhoto | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    async function load() {
      try {
        const [evt, gameList, photoList] = await Promise.all([
          getEventById(eventId!),
          listPublicGames(eventId!),
          listPublicEventPhotos(eventId!),
        ]);
        if (!active) return;
        setEvent(evt);
        setGames(gameList);
        setPhotos(photoList);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load event details.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventId]);

  const categories = ['All', ...Array.from(new Set(games.map((g) => g.category)))];
  const visibleGames =
    categoryFilter === 'All' ? games : games.filter((g) => g.category === categoryFilter);

  return (
    <PublicLayout>
      <section className="bg-campus-tint min-h-[75vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-300 hover:text-white mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Events</span>
          </Link>

          {loading ? (
            <div className="h-96 card-3d rounded-2xl animate-pulse" />
          ) : error ? (
            <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-6 text-sm">
              {error}
            </div>
          ) : !event ? (
            <div className="card-3d rounded-2xl p-12 text-center">
              <h1 className="font-display text-xl font-bold text-white">Event Not Found</h1>
              <p className="mt-2 text-sm text-slate-300">
                This event may be unpublished, archived, or no longer available.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Event Header Card */}
              <div className="card-3d rounded-2xl overflow-hidden">
                <SportBannerGraphic
                  bannerUrl={event.bannerUrl}
                  title={event.name}
                  subtitle={event.venue || 'Government Engineering College, Khagaria'}
                  className="h-56 sm:h-72"
                />
                <div className="p-6 sm:p-8">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="font-display text-3xl font-bold text-white">{event.name}</h1>
                    <StatusTag status={event.status} />
                  </div>

                  <p className="mt-3 text-base text-slate-300 leading-relaxed max-w-3xl whitespace-pre-line">
                    {event.description || event.shortDescription}
                  </p>

                  {event.highlightsText && event.highlightsText.trim().length > 0 && (
                    <div className="mt-6 p-5 bg-[#080C17] border border-blue-500/30 rounded-xl">
                      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-red-400 mb-2">
                        Schedule, Reporting &amp; Event Highlights
                      </h2>
                      <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-line">
                        {event.highlightsText}
                      </p>
                    </div>
                  )}

                  <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-start gap-2.5">
                      <Calendar className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-blue-300">Event Dates</p>
                        <p className="font-medium text-white tabular-nums">
                          {formatDate(event.startAt)} – {formatDate(event.endAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Clock className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-blue-300">Registration Window</p>
                        <p className="font-medium text-white tabular-nums">
                          {formatDate(event.registrationStartAt)} – {formatDateTime(event.registrationEndAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-blue-300">Venue</p>
                        <p className="font-medium text-white">
                          {event.venue || 'Campus Sports Grounds'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Games List */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white">
                      Games &amp; Disciplines ({games.length})
                    </h2>
                    <p className="text-sm text-slate-300">
                      Choose a game to inspect eligibility, rules, and submit your entry.
                    </p>
                  </div>

                  {categories.length > 2 && (
                    <div className="flex flex-wrap gap-1 p-1.5 card-3d rounded-xl">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            categoryFilter === cat
                              ? 'btn-3d-mix'
                              : 'text-slate-300 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {visibleGames.length === 0 ? (
                  <div className="card-3d rounded-2xl p-10 text-center text-sm text-slate-300">
                    No open or published games have been added to this event yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {visibleGames.map((game, idx) => {
                      const canRegister =
                        event.status === 'registration_open' && game.registrationStatus === 'open';
                      return (
                        <div
                          key={game.id}
                          className={`${
                            idx % 2 === 0 ? 'card-3d-blue' : 'card-3d-red'
                          } card-3d-hover rounded-2xl p-6 flex flex-col justify-between`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-2">
                              <span className="font-semibold text-blue-300">{game.category}</span>
                              <StatusTag status={game.registrationStatus} />
                            </div>
                            <h3 className="font-display text-xl font-bold text-white">
                              {game.name}
                            </h3>
                            <p className="mt-2 text-sm text-slate-300 line-clamp-3">
                              {game.description}
                            </p>

                            <div className="mt-4 pt-4 border-t border-white/10 space-y-1.5 text-xs text-slate-300">
                              <p className="inline-flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-red-400" />
                                <span>
                                  {game.participationType === 'team'
                                    ? `Team (${game.minTeamSize}–${game.maxTeamSize} players)`
                                    : game.participationType === 'doubles'
                                    ? 'Doubles (2 players)'
                                    : 'Individual'}
                                </span>
                              </p>
                              <p className="tabular-nums text-slate-400">
                                Deadline: {formatDateTime(game.registrationDeadline)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-6 flex items-center justify-between gap-3">
                            <Link
                              to={`/events/${event.id}/games/${game.id}`}
                              className="text-xs font-semibold text-blue-300 hover:text-white whitespace-nowrap shrink-0"
                            >
                              Rules &amp; Details
                            </Link>
                            {canRegister ? (
                              <Link
                                to={`/register/${event.id}/${game.id}`}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg btn-3d-red whitespace-nowrap shrink-0"
                              >
                                <span>Register</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            ) : (
                              <span className="text-xs text-slate-500">Registration Closed</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Event Photos Strip */}
              {photos.length > 0 && (
                <div className="pt-6 border-t border-white/10 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Camera className="w-5 h-5 text-red-400" />
                      <h2 className="font-display text-2xl font-bold text-white">
                        Photos from {event.name}
                      </h2>
                    </div>
                    <Link
                      to="/photos"
                      className="text-xs font-semibold text-blue-300 hover:text-white"
                    >
                      Open Full Gallery &rarr;
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {photos.map((photo, idx) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightboxPhoto(photo)}
                        className={`${
                          idx % 2 === 0 ? 'card-3d-blue' : 'card-3d-red'
                        } card-3d-hover rounded-2xl overflow-hidden text-left`}
                      >
                        <div className="aspect-[16/10] bg-[#07090F]">
                          <img
                            src={photo.imageUrl}
                            alt={photo.title || event.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        {photo.title && (
                          <p className="p-3 text-xs font-semibold text-white truncate">
                            {photo.title}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-w-3xl w-full card-3d rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white truncate">
                {lightboxPhoto.title || event?.name}
              </h3>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
                aria-label="Close preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#05070C] flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={lightboxPhoto.imageUrl}
                alt={lightboxPhoto.title || event?.name || 'Event photo'}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
            {lightboxPhoto.caption && (
              <p className="px-5 py-3.5 text-sm text-slate-200 border-t border-white/10">
                {lightboxPhoto.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

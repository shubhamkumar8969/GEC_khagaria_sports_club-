import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Flame,
  LogIn,
  MapPin,
  Medal,
  Megaphone,
  Trophy,
  X,
} from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { SportBannerGraphic } from '@/src/components/common/SportBannerGraphic';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listPublicEvents, listPublicGames } from '@/src/services/firebase/events';
import { listPublicAnnouncements } from '@/src/services/firebase/announcements';
import { listPublicResults } from '@/src/services/firebase/results';
import { listPublicEventPhotos } from '@/src/services/firebase/photos';
import { getRegisteredStudentsCount } from '@/src/services/firebase/students';
import { DEFAULT_SITE_SETTINGS } from '@/src/services/firebase/settings';
import { formatDate } from '@/src/utils/formatters';
import type {
  Announcement,
  EventGame,
  EventPhoto,
  GameCategory,
  PublishedResult,
  SportEvent,
} from '@/src/types/models';

const LEGACY_HERO_TITLES = new Set([
  'Official Collegiate Sports Arena & Championship Portal',
]);

const CATEGORY_CARD_STYLE: Record<
  GameCategory,
  { surface: string; badge: string; btn: string }
> = {
  Outdoor: {
    surface: 'card-3d-emerald card-3d-hover',
    badge: 'text-emerald-300',
    btn: 'btn-3d-emerald',
  },
  Indoor: {
    surface: 'card-3d-red card-3d-hover',
    badge: 'text-rose-300',
    btn: 'btn-3d-red',
  },
  Athletics: {
    surface: 'card-3d-gold card-3d-hover',
    badge: 'text-amber-300',
    btn: 'btn-3d-gold',
  },
  Esports: {
    surface: 'card-3d-cyan card-3d-hover',
    badge: 'text-cyan-300',
    btn: 'btn-3d-blue',
  },
  Other: {
    surface: 'card-3d-blue card-3d-hover',
    badge: 'text-blue-300',
    btn: 'btn-3d-blue',
  },
};

const EVENT_CARD_VARIANTS = [
  { surface: 'card-3d-cyan', btn: 'btn-3d-blue', icon: 'text-amber-300', pin: 'text-cyan-400' },
  { surface: 'card-3d-emerald', btn: 'btn-3d-emerald', icon: 'text-emerald-300', pin: 'text-amber-300' },
  { surface: 'card-3d-gold', btn: 'btn-3d-gold', icon: 'text-amber-300', pin: 'text-sky-300' },
  { surface: 'card-3d-red', btn: 'btn-3d-red', icon: 'text-rose-300', pin: 'text-amber-300' },
];

const PILLAR_ACCENTS = [
  'bg-gradient-to-br from-[#10B981] to-[#047857] text-white shadow-[0_3px_0_#064E3B]',
  'bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-[#090D16] shadow-[0_3px_0_#78350F]',
  'bg-gradient-to-br from-[#06B6D4] to-[#1D4ED8] text-white shadow-[0_3px_0_#1E3A8A]',
  'bg-gradient-to-br from-[#F43F5E] to-[#BE123C] text-white shadow-[0_3px_0_#881337]',
];

const PILLAR_SURFACES = [
  'card-3d-emerald card-3d-hover',
  'card-3d-gold card-3d-hover',
  'card-3d-cyan card-3d-hover',
  'card-3d-red card-3d-hover',
];

const GALLERY_CARD_VARIANTS = [
  { surface: 'card-3d-cyan', tag: 'text-cyan-300' },
  { surface: 'card-3d-gold', tag: 'text-amber-300' },
  { surface: 'card-3d-emerald', tag: 'text-emerald-300' },
  { surface: 'card-3d-red', tag: 'text-rose-300' },
];

export function HomePage() {
  const { settings } = useSiteSettings();
  const { firebaseUser } = useAuth();

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [featuredGames, setFeaturedGames] = useState<EventGame[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [results, setResults] = useState<PublishedResult[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [registeredStudentsCount, setRegisteredStudentsCount] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [photoFilterEventId, setPhotoFilterEventId] = useState<string>('all');
  const [lightboxPhoto, setLightboxPhoto] = useState<EventPhoto | null>(null);
  const [lightboxNotice, setLightboxNotice] = useState<Announcement | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [evList, annList, resList, photoList, studentCount] = await Promise.all([
          listPublicEvents(),
          listPublicAnnouncements(),
          listPublicResults(),
          listPublicEventPhotos(),
          getRegisteredStudentsCount(),
        ]);
        if (!active) return;
        setRegisteredStudentsCount(studentCount);

        const orderedEvents = [...evList].sort((a, b) => {
          const rank = (ev: SportEvent) => {
            if (ev.status === 'registration_open' && ev.featured) return 0;
            if (ev.status === 'registration_open') return 1;
            if (ev.status === 'ongoing') return 2;
            if (ev.featured) return 3;
            if (ev.status === 'published') return 4;
            return 5;
          };
          return rank(a) - rank(b);
        });

        setEvents(orderedEvents);
        setAnnouncements(annList.slice(0, 4));
        setResults(resList.slice(0, 6));
        setPhotos(photoList);

        const feat = orderedEvents.find((e) => e.featured) || orderedEvents[0];
        if (feat) {
          const games = await listPublicGames(feat.id);
          if (active) setFeaturedGames(games);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load Sports Club updates.');
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

  const showcaseEvents = useMemo(() => {
    const liveOnly = events.filter((e) =>
      ['registration_open', 'ongoing', 'published'].includes(e.status)
    );
    return liveOnly.length > 0 ? liveOnly : events;
  }, [events]);

  const activeShowcaseEvent = showcaseEvents[showcaseIndex] || showcaseEvents[0] || null;
  const featuredEvent = events.find((e) => e.featured) || events[0] || null;
  const openEventsCount = events.filter((e) => e.status === 'registration_open').length;
  const vis = settings.sectionVisibility;

  const photoEventOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of photos) {
      if (!map.has(p.eventId)) map.set(p.eventId, p.eventName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [photos]);

  const visiblePhotos = useMemo(() => {
    const list =
      photoFilterEventId === 'all'
        ? photos
        : photos.filter((p) => p.eventId === photoFilterEventId);
    return list.slice(0, 8);
  }, [photos, photoFilterEventId]);

  const displayHeroEyebrow =
    !settings.heroEyebrow?.trim() ||
    settings.heroEyebrow.trim() === 'Government Engineering College, Khagaria'
      ? DEFAULT_SITE_SETTINGS.heroEyebrow
      : settings.heroEyebrow.trim();

  const displayHeroTitle =
    !settings.heroTitle?.trim() || LEGACY_HERO_TITLES.has(settings.heroTitle.trim())
      ? DEFAULT_SITE_SETTINGS.heroTitle
      : settings.heroTitle.trim();

  const isDefaultEnergeticTitle = displayHeroTitle === DEFAULT_SITE_SETTINGS.heroTitle;

  return (
    <PublicLayout>
      {/* Section 1: Vibrant Multi-Sport Championship Hero & Live Event Spotlight */}
      {vis.showHero3D && (
        <section className="bg-hero-arena text-white border-b border-sky-500/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center space-y-5">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                  <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{displayHeroEyebrow}</span>
                </div>
                <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08] text-balance">
                  {isDefaultEnergeticTitle ? (
                    <>
                      Play Bold. Compete Hard.{' '}
                      <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
                        Rise as Campus Champions.
                      </span>
                    </>
                  ) : (
                    displayHeroTitle
                  )}
                </h1>
                <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-xl">
                  {settings.heroSubtitle || settings.tagline}
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3.5">
                  <Link
                    to="/events"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-bold rounded-xl btn-3d-gold whitespace-nowrap shrink-0"
                  >
                    <span>Event Registration</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/results"
                    className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl btn-3d-blue whitespace-nowrap shrink-0"
                  >
                    <Trophy className="w-4 h-4 text-amber-300" />
                    <span>View Results</span>
                  </Link>
                </div>

                {showcaseEvents.length > 1 && (
                  <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-emerald-300 mr-1">Live Events:</span>
                    {showcaseEvents.slice(0, 4).map((ev, idx) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setShowcaseIndex(idx)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                          showcaseIndex === idx
                            ? 'btn-3d-mix'
                            : 'bg-[#10182E] text-slate-200 border border-sky-500/30 hover:text-white hover:border-amber-400/60'
                        }`}
                      >
                        {ev.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Live Event Showcase Card with Normal Tactile 3D Depth */}
              <div className="lg:col-span-6 flex">
                {loading ? (
                  <div className="w-full min-h-[360px] rounded-2xl bg-[#10172A] border border-blue-500/20 animate-pulse" />
                ) : activeShowcaseEvent ? (
                  <div className="w-full card-3d rounded-2xl overflow-hidden flex flex-col justify-between">
                    <div className="relative">
                      <SportBannerGraphic
                        bannerUrl={activeShowcaseEvent.bannerUrl}
                        title={activeShowcaseEvent.name}
                        subtitle={activeShowcaseEvent.venue || settings.institutionName}
                        className="h-52 sm:h-60"
                      />
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                        <StatusTag status={activeShowcaseEvent.status} />
                        {showcaseEvents.length > 1 && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setShowcaseIndex(
                                  (showcaseIndex - 1 + showcaseEvents.length) % showcaseEvents.length
                                )
                              }
                              className="p-1.5 rounded-lg bg-[#07090F]/85 text-white hover:bg-[#1D4ED8] border border-white/20 transition-colors"
                              aria-label="Previous live event"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setShowcaseIndex((showcaseIndex + 1) % showcaseEvents.length)
                              }
                              className="p-1.5 rounded-lg bg-[#07090F]/85 text-white hover:bg-[#DC2626] border border-white/20 transition-colors"
                              aria-label="Next live event"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
                            {settings.showcaseTitle || 'Live Event Spotlight'}
                          </p>
                          <h2 className="mt-1 font-display text-2xl font-bold text-white">
                            {activeShowcaseEvent.name}
                          </h2>
                          <p className="mt-1.5 text-sm text-slate-300 line-clamp-2">
                            {activeShowcaseEvent.shortDescription}
                          </p>
                        </div>

                        {activeShowcaseEvent.highlightsText && (
                          <div className="p-3.5 rounded-xl bg-[#080C17] border border-blue-500/25 text-xs text-slate-200 leading-relaxed whitespace-pre-line line-clamp-3">
                            {activeShowcaseEvent.highlightsText}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-200 pt-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-red-400 shrink-0" />
                            <span className="tabular-nums">
                              {formatDate(activeShowcaseEvent.startAt)} –{' '}
                              {formatDate(activeShowcaseEvent.endAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                            <span className="truncate">
                              {activeShowcaseEvent.venue || 'Campus Sports Grounds'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                        <Link
                          to={`/events/${activeShowcaseEvent.id}`}
                          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg btn-3d-mix whitespace-nowrap"
                        >
                          <span>
                            {activeShowcaseEvent.status === 'registration_open'
                              ? 'Register & View Live Games'
                              : 'View Live Event Details'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          to="/photos"
                          className="text-xs font-medium text-blue-300 hover:text-white inline-flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5 text-red-400" />
                          <span>Event Photos</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full card-3d rounded-2xl p-8 flex flex-col justify-center space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
                      Live Event Hub
                    </p>
                    <h2 className="font-display text-2xl font-bold text-white">
                      Live Sports Event Showcase
                    </h2>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      {settings.showcaseSubtitle}
                    </p>
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <Link
                        to="/events"
                        className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg btn-3d-red"
                      >
                        <span>Browse Live Events</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                      <Link
                        to="/results"
                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg btn-3d-blue"
                      >
                        <span>Results Panel</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section 2: Multi-Sport Championship Live Metrics Band */}
      {vis.showMetrics && (
        <section className="bg-arena-band border-b border-sky-500/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="p-4 rounded-xl card-3d-cyan">
                <p className="text-xs font-medium text-cyan-200/90">Students Registered</p>
                <p className="mt-1 font-display text-2xl font-bold text-white tabular-nums">
                  {loading ? '—' : registeredStudentsCount}
                </p>
              </div>
              <div className="p-4 rounded-xl card-3d-emerald">
                <p className="text-xs font-medium text-emerald-200/90">Live Registrations Open</p>
                <p className="mt-1 font-display text-2xl font-bold text-emerald-400 tabular-nums">
                  {loading ? '—' : openEventsCount}
                </p>
              </div>
              <div className="p-4 rounded-xl card-3d-gold">
                <p className="text-xs font-medium text-amber-200/90">Active Disciplines</p>
                <p className="mt-1 font-display text-2xl font-bold text-amber-300 tabular-nums">
                  {loading ? '—' : featuredGames.length}
                </p>
              </div>
              <div className="p-4 rounded-xl card-3d-red">
                <p className="text-xs font-medium text-rose-200/90">Event Photos Published</p>
                <p className="mt-1 font-display text-2xl font-bold text-rose-300 tabular-nums">
                  {loading ? '—' : photos.length}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-4 text-sm">
            {error}
          </div>
        </div>
      )}

      {/* Section 3: Live Events Directory & Sport Disciplines */}
      {vis.showEvents && (
        <>
          <section className="bg-campus-tint py-14">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                    Active Campus Tournaments
                  </p>
                  <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
                    Live Events &amp; Tournaments
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Register across multiple campus events and multiple games with real-time slot verification.
                  </p>
                </div>
                <Link
                  to="/events"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#10172A] border border-blue-500/35 rounded-lg hover:border-red-400 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>View All Events</span>
                  <ArrowRight className="w-3.5 h-3.5 text-red-400" />
                </Link>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-72 card-3d rounded-2xl animate-pulse"
                    />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="card-3d rounded-2xl p-10 text-center">
                  <p className="text-base font-semibold text-white">No live events right now</p>
                  <p className="mt-1 text-sm text-slate-300">
                    Administrators can create and publish live tournaments inside the Admin Events dashboard.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.slice(0, 6).map((evt, idx) => {
                    const variant = EVENT_CARD_VARIANTS[idx % EVENT_CARD_VARIANTS.length];
                    return (
                      <article
                        key={evt.id}
                        className={`${variant.surface} card-3d-hover rounded-2xl overflow-hidden flex flex-col justify-between`}
                      >
                        <div>
                          <SportBannerGraphic
                            bannerUrl={evt.bannerUrl}
                            title={evt.name}
                            subtitle={evt.venue || settings.institutionName}
                            className="h-44"
                          />
                          <div className="p-5">
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <span className="text-xs text-slate-200 tabular-nums inline-flex items-center gap-1.5">
                                <Calendar className={`w-3.5 h-3.5 ${variant.icon}`} />
                                {formatDate(evt.startAt)}
                              </span>
                              <StatusTag status={evt.status} />
                            </div>
                            <h3 className="font-display text-lg font-bold text-white">
                              {evt.name}
                            </h3>
                            <p className="mt-2 text-sm text-slate-300 line-clamp-2">
                              {evt.shortDescription}
                            </p>
                          </div>
                        </div>
                        <div className="px-5 py-4 bg-[#080B14]/80 border-t border-white/10 flex items-center justify-between gap-3">
                          <span className="text-xs text-slate-200 truncate max-w-[60%] inline-flex items-center gap-1">
                            <MapPin className={`w-3.5 h-3.5 ${variant.pin} shrink-0`} />
                            {evt.venue || 'Campus Grounds'}
                          </span>
                          <Link
                            to={`/events/${evt.id}`}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${variant.btn}`}
                          >
                            <span>{evt.status === 'registration_open' ? 'Register' : 'Details'}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {featuredEvent && featuredGames.length > 0 && (
            <section className="bg-arena-band border-y border-blue-500/20 py-14">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
                      Multi-Sport Categories
                    </p>
                    <h2 className="mt-1 font-display text-2xl font-bold text-white">
                      Disciplines in {featuredEvent.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-300">
                      Select any sport to review rules, team sizes, and submit your entry online.
                    </p>
                  </div>
                  <Link
                    to={`/events/${featuredEvent.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#10172A] border border-red-500/35 rounded-lg hover:border-blue-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>All Games in {featuredEvent.name}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-red-400" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {featuredGames.map((game) => {
                    const catTheme =
                      CATEGORY_CARD_STYLE[game.category] || CATEGORY_CARD_STYLE.Other;
                    return (
                      <div
                        key={game.id}
                        className={`rounded-2xl p-5 flex flex-col justify-between ${catTheme.surface}`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 text-xs mb-2">
                            <span className={`font-semibold ${catTheme.badge}`}>
                              {game.category} ·{' '}
                              {game.participationType === 'team'
                                ? `Team (${game.minTeamSize}–${game.maxTeamSize})`
                                : game.participationType === 'doubles'
                                ? 'Doubles (2 Players)'
                                : 'Individual'}
                            </span>
                            <StatusTag status={game.registrationStatus} />
                          </div>
                          <h3 className="font-display text-lg font-bold text-white">
                            {game.name}
                          </h3>
                          <p className="mt-1.5 text-sm text-slate-300 line-clamp-2">
                            {game.description}
                          </p>
                        </div>

                        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
                          <Link
                            to={`/events/${featuredEvent.id}/games/${game.id}`}
                            className="text-xs font-semibold text-blue-300 hover:text-white"
                          >
                            View Rules
                          </Link>
                          {featuredEvent.status === 'registration_open' &&
                          game.registrationStatus === 'open' ? (
                            <Link
                              to={`/register/${featuredEvent.id}/${game.id}`}
                              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${catTheme.btn}`}
                            >
                              Register Now
                            </Link>
                          ) : (
                            <Link
                              to={`/events/${featuredEvent.id}/games/${game.id}`}
                              className="text-xs font-semibold text-red-300 hover:underline"
                            >
                              View Details
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Section 4: Red + Blue + Black Results Panel & Podium Winners */}
      {vis.showResults && settings.showPublicResults && (
        <section className="bg-results-tint py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                  Verified Champions
                </p>
                <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
                  Results Panel &amp; Podium Winners
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Latest tournament standings and verified podium outcomes published by the Sports Club.
                </p>
              </div>
              <Link
                to="/results"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg btn-3d-gold whitespace-nowrap shrink-0"
              >
                <span>Open Full Results Panel</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {results.length === 0 ? (
              <div className="card-3d rounded-2xl p-8 text-center text-sm text-slate-300">
                No public results have been published yet. Check back after live fixtures conclude.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {results.map((res) => {
                  const isWinner = res.placement === 'winner';
                  const isRunner = res.placement === 'runner_up';
                  const cardTone = isWinner
                    ? 'card-3d-gold card-3d-hover'
                    : isRunner
                    ? 'card-3d-cyan card-3d-hover'
                    : 'card-3d-emerald card-3d-hover';

                  return (
                    <article
                      key={res.id}
                      className={`rounded-2xl p-5 flex flex-col justify-between ${cardTone}`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span className="text-xs font-medium text-slate-200 truncate">
                            {res.eventName} · {res.gameName}
                          </span>
                          <StatusTag status={res.placement} />
                        </div>
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                              isWinner
                                ? 'bg-gradient-to-br from-[#FBBF24] to-[#D97706] text-[#090D16]'
                                : isRunner
                                ? 'bg-gradient-to-br from-[#38BDF8] to-[#2563EB] text-white'
                                : 'bg-gradient-to-br from-[#34D399] to-[#059669] text-[#04130E]'
                            }`}
                          >
                            {isWinner ? (
                              <Trophy className="w-5 h-5" />
                            ) : (
                              <Medal className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-base font-bold text-white truncate">
                              {res.winnerDisplayName}
                            </h3>
                            <p className="text-xs text-sky-200/85 mt-0.5">
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
            )}
          </div>
        </section>
      )}

      {/* Section 5: Club Pillars & Facilities */}
      {vis.showHighlights && settings.aboutHighlights.length > 0 && (
        <section className="bg-arena-band border-y border-blue-500/20 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Campus Sports Ecosystem
              </p>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
                {settings.aboutMissionTitle}
              </h2>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">
                {settings.aboutMissionBody}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {settings.aboutHighlights.map((item, idx) => (
                <div
                  key={`${item.title}-${idx}`}
                  className={`rounded-2xl p-5 flex flex-col justify-between ${
                    PILLAR_SURFACES[idx % PILLAR_SURFACES.length]
                  }`}
                >
                  <div>
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-mono text-xs font-bold ${
                        PILLAR_ACCENTS[idx % PILLAR_ACCENTS.length]
                      }`}
                    >
                      0{idx + 1}
                    </span>
                    <h3 className="mt-3 font-display text-base font-bold text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Section 6: Official Announcements */}
      {vis.showAnnouncements && (
        <section className="bg-notices-tint py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Official Bulletins
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold text-white">
                  Club Announcements
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Official notices, fixture schedules, and reporting instructions.
                </p>
              </div>
              <Link
                to="/announcements"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#10172A] border border-blue-500/35 rounded-lg hover:border-red-400 transition-colors whitespace-nowrap shrink-0"
              >
                <span>All Notices</span>
                <ArrowRight className="w-3.5 h-3.5 text-red-400" />
              </Link>
            </div>

            {announcements.length === 0 ? (
              <div className="card-3d rounded-2xl p-8 text-center text-sm text-slate-300">
                No announcements published yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {announcements.map((ann, idx) => (
                  <div
                    key={ann.id}
                    className={`${
                      idx % 2 === 0 ? 'card-3d-blue' : 'card-3d-red'
                    } card-3d-hover rounded-2xl p-6`}
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-red-400">
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>{ann.category}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatDate(ann.publishAt)}</span>
                    </div>
                    <h3 className="font-display text-lg font-bold text-white">{ann.title}</h3>
                    <p className="mt-2 text-sm text-slate-300 line-clamp-3 leading-relaxed">
                      {ann.body}
                    </p>
                    {ann.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxNotice(ann)}
                        className="mt-4 block w-full rounded-xl overflow-hidden border border-blue-400/25 bg-[#05070C]"
                        title="Click to view full notice image"
                      >
                        <img
                          src={ann.imageUrl}
                          alt={ann.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-40 object-cover hover:scale-[1.02] transition-transform duration-200"
                        />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Section 7: Student Dashboard & Certificate Hub Banner */}
      {vis.showPortalCta && (
        <section className="bg-cta-ribbon text-white border-t border-red-500/25 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-300 mb-2">
                <Award className="w-4 h-4 text-red-400" />
                <span>STUDENT DASHBOARD &amp; CERTIFICATES</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                View Participating Events &amp; Download Official Certificates
              </h2>
              <p className="mt-2 text-sm text-blue-100 leading-relaxed">
                Sign in with Google and save your Name, Registration Number, Phone Number, Branch,
                and Year to register for campus tournaments and download participation or winner
                certificates.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {firebaseUser ? (
                <Link
                  to="/student"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl btn-3d-blue whitespace-nowrap"
                >
                  <span>Open Student Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link
                  to="/student/login"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl btn-3d-red whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Student Login</span>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Section 8: Event Photo Gallery directly above the Footer */}
      {vis.showPhotoGallery !== false && (
        <section className="bg-gallery-tint border-t border-blue-500/20 py-14">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-red-400 mb-1">
                  <Camera className="w-4 h-4" />
                  <span>CAMPUS EVENT MEMORIES</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                  Event Photo Gallery
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Highlights uploaded by Sports Club coordinators organized by tournament.
                </p>
              </div>
              <Link
                to="/photos"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#10172A] border border-blue-500/35 rounded-lg hover:border-red-400 transition-colors whitespace-nowrap shrink-0"
              >
                <span>Open Full Photo Gallery</span>
                <ArrowRight className="w-3.5 h-3.5 text-red-400" />
              </Link>
            </div>

            {photoEventOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPhotoFilterEventId('all')}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    photoFilterEventId === 'all'
                      ? 'btn-3d-mix'
                      : 'bg-[#10172A] text-slate-300 border border-blue-500/25 hover:text-white'
                  }`}
                >
                  All Events ({photos.length})
                </button>
                {photoEventOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPhotoFilterEventId(opt.id)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      photoFilterEventId === opt.id
                        ? 'btn-3d-mix'
                        : 'bg-[#10172A] text-slate-300 border border-blue-500/25 hover:text-white'
                    }`}
                  >
                    {opt.name}
                  </button>
                ))}
              </div>
            )}

            {visiblePhotos.length === 0 ? (
              <div className="card-3d rounded-2xl p-8 text-center text-sm text-slate-300">
                No event photos published yet. Check back after live tournament matches!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {visiblePhotos.map((photo, idx) => {
                  const gal = GALLERY_CARD_VARIANTS[idx % GALLERY_CARD_VARIANTS.length];
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLightboxPhoto(photo)}
                      className={`group ${gal.surface} card-3d-hover rounded-2xl overflow-hidden text-left flex flex-col`}
                    >
                      <div className="aspect-[16/10] w-full bg-[#07090F] overflow-hidden">
                        <img
                          src={photo.imageUrl}
                          alt={photo.title || photo.eventName}
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        />
                      </div>
                      <div className="p-3.5 w-full">
                        <p className={`text-[11px] font-semibold ${gal.tag} truncate`}>
                          {photo.eventName}
                        </p>
                        <p className="mt-0.5 text-sm font-bold text-white truncate">
                          {photo.title || photo.eventName}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Lightbox Modal */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.title || lightboxPhoto.eventName}
        >
          <div className="max-w-3xl w-full card-3d rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-400 truncate">
                  {lightboxPhoto.eventName}
                </p>
                <h3 className="font-display text-base font-bold text-white truncate">
                  {lightboxPhoto.title || lightboxPhoto.eventName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close photo"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#05070C] flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={lightboxPhoto.imageUrl}
                alt={lightboxPhoto.title || lightboxPhoto.eventName}
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

      {/* Notice Image Lightbox Modal */}
      {lightboxNotice && lightboxNotice.imageUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={lightboxNotice.title}
        >
          <div className="max-w-3xl w-full card-3d rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-400 truncate">
                  {lightboxNotice.category} · {formatDate(lightboxNotice.publishAt)}
                </p>
                <h3 className="font-display text-base font-bold text-white truncate">
                  {lightboxNotice.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxNotice(null)}
                className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close notice preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-[#05070C] flex items-center justify-center max-h-[75vh] overflow-auto p-2">
              <img
                src={lightboxNotice.imageUrl}
                alt={lightboxNotice.title}
                referrerPolicy="no-referrer"
                className="max-h-[72vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, MapPin, Search } from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { SportBannerGraphic } from '@/src/components/common/SportBannerGraphic';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { listPublicEvents } from '@/src/services/firebase/events';
import { formatDate } from '@/src/utils/formatters';
import type { EventStatus, SportEvent } from '@/src/types/models';

const FILTER_TABS: Array<{ key: 'all' | EventStatus; label: string }> = [
  { key: 'all', label: 'All Events' },
  { key: 'registration_open', label: 'Live · Registration Open' },
  { key: 'published', label: 'Live · Published' },
  { key: 'ongoing', label: 'Live · Ongoing' },
  { key: 'completed', label: 'Completed' },
];

export function EventsPage() {
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | EventStatus>('all');

  useEffect(() => {
    let active = true;
    listPublicEvents()
      .then((list) => {
        if (active) setEvents(list);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load events.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.shortDescription.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q)
      );
    });
  }, [events, search, statusFilter]);

  return (
    <PublicLayout>
      <section className="bg-subpage-arena text-white py-12 border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
            Campus Tournaments Directory
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold">Live Sports Events</h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl">
            Explore live tournaments, review game rules, and submit online registrations.
          </p>
        </div>
      </section>

      <section className="bg-campus-tint min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Search & Filter Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
            <div className="flex flex-wrap items-center gap-1 p-1.5 card-3d rounded-xl">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap shrink-0 ${
                    statusFilter === tab.key
                      ? 'btn-3d-mix'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:w-72">
              <label htmlFor="events-search" className="sr-only">
                Search events
              </label>
              <Search className="w-4 h-4 text-blue-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="events-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search event name or venue..."
                className="w-full pl-9 pr-3 py-2 bg-[#0B101D] border border-blue-500/35 rounded-lg text-sm text-white placeholder-slate-400 focus:border-red-400 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 card-3d rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card-3d rounded-2xl p-12 text-center">
              <h2 className="font-display text-lg font-bold text-white">
                No matching events found
              </h2>
              <p className="mt-1 text-sm text-slate-300">
                Try clearing your filter or check back once the Sports Club publishes new events.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((evt, idx) => (
                <article
                  key={evt.id}
                  className={`${
                    idx % 2 === 0 ? 'card-3d-blue' : 'card-3d-red'
                  } card-3d-hover rounded-2xl overflow-hidden flex flex-col justify-between`}
                >
                  <div>
                    <SportBannerGraphic
                      bannerUrl={evt.bannerUrl}
                      title={evt.name}
                      subtitle={evt.venue || 'GEC Khagaria'}
                      className="h-44"
                    />
                    <div className="p-5">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs text-slate-300 tabular-nums inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-red-400" />
                          {formatDate(evt.startAt)} – {formatDate(evt.endAt)}
                        </span>
                        <StatusTag status={evt.status} />
                      </div>
                      <h2 className="font-display text-xl font-bold text-white">{evt.name}</h2>
                      <p className="mt-2 text-sm text-slate-300 line-clamp-3">
                        {evt.shortDescription}
                      </p>
                      {evt.venue && (
                        <p className="mt-3 text-xs text-slate-300 inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-blue-400" />
                          <span>{evt.venue}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 py-4 bg-[#080B14]/80 border-t border-white/10 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400 tabular-nums">
                      Reg ends {formatDate(evt.registrationEndAt)}
                    </span>
                    <Link
                      to={`/events/${evt.id}`}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 ${
                        idx % 2 === 0 ? 'btn-3d-blue' : 'btn-3d-red'
                      }`}
                    >
                      <span>View Games</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

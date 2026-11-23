import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listPublicEventPhotos } from '@/src/services/firebase/photos';
import { listPublicEvents } from '@/src/services/firebase/events';
import { formatDate } from '@/src/utils/formatters';
import type { EventPhoto, SportEvent } from '@/src/types/models';

export function PhotosPage() {
  const { settings } = useSiteSettings();
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [photoList, eventList] = await Promise.all([
          listPublicEventPhotos(),
          listPublicEvents(),
        ]);
        if (!active) return;
        setPhotos(photoList);
        setEvents(eventList);
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load event photo gallery.');
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

  const eventFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const ev of events) map.set(ev.id, ev.name);
    for (const ph of photos) {
      if (!map.has(ph.eventId)) map.set(ph.eventId, ph.eventName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [events, photos]);

  const filteredPhotos = useMemo(() => {
    if (selectedEventId === 'all') return photos;
    return photos.filter((p) => p.eventId === selectedEventId);
  }, [photos, selectedEventId]);

  const activePhoto = lightboxIndex !== null ? filteredPhotos[lightboxIndex] ?? null : null;

  return (
    <PublicLayout>
      <section className="bg-subpage-arena text-white py-12 border-b border-blue-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              {settings.clubName}
            </p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold">
              Event Photo Gallery
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              Match action, opening ceremonies, and podium celebrations organized by tournament and campus event.
            </p>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center px-4 py-2.5 text-xs font-semibold rounded-lg btn-3d-red whitespace-nowrap shrink-0"
          >
            Explore Live Events
          </Link>
        </div>
      </section>

      <section className="bg-gallery-tint min-h-[60vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          {error && (
            <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          {/* Event Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 card-3d rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedEventId('all')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  selectedEventId === 'all'
                    ? 'btn-3d-mix'
                    : 'bg-[#080B14] text-slate-300 border border-blue-500/25 hover:text-white'
                }`}
              >
                All Events ({photos.length})
              </button>
              {eventFilterOptions.map((ev) => {
                const count = photos.filter((p) => p.eventId === ev.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      selectedEventId === ev.id
                        ? 'btn-3d-mix'
                        : 'bg-[#080B14] text-slate-300 border border-blue-500/25 hover:text-white'
                    }`}
                  >
                    {ev.name} ({count})
                  </button>
                );
              })}
            </div>
            <span className="text-xs text-blue-300 tabular-nums">
              Showing {filteredPhotos.length} photo{filteredPhotos.length === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="h-64 card-3d rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredPhotos.length === 0 ? (
            <div className="card-3d rounded-2xl p-12 text-center space-y-2">
              <Camera className="w-8 h-8 text-red-400 mx-auto" />
              <h2 className="font-display text-lg font-bold text-white">
                No Event Photos Published Yet
              </h2>
              <p className="text-sm text-slate-300 max-w-md mx-auto">
                Sports Club administrators can upload tournament highlights and event photographs from the Admin Photo Manager.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPhotos.map((photo, idx) => (
                <article
                  key={photo.id}
                  className={`${
                    idx % 2 === 0 ? 'card-3d-blue' : 'card-3d-red'
                  } card-3d-hover rounded-2xl overflow-hidden flex flex-col`}
                >
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className="relative aspect-[16/10] w-full bg-[#07090F] overflow-hidden text-left group focus:outline-none"
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.title || photo.eventName}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </button>
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400 mb-1">
                        <span className="font-semibold text-red-400 truncate">
                          {photo.eventName}
                        </span>
                        <span className="tabular-nums shrink-0 inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-blue-400" />
                          {formatDate(photo.createdAt)}
                        </span>
                      </div>
                      <h2 className="font-display text-base font-bold text-white">
                        {photo.title || photo.eventName}
                      </h2>
                      {photo.caption && (
                        <p className="mt-1 text-xs text-slate-300 line-clamp-2">{photo.caption}</p>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Modal */}
      {activePhoto && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.title || activePhoto.eventName}
        >
          <div className="relative max-w-4xl w-full card-3d rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-400 truncate">
                  {activePhoto.eventName}
                </p>
                <h2 className="font-display text-base font-bold text-white truncate">
                  {activePhoto.title || activePhoto.eventName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close photo preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#05070C] flex items-center justify-center max-h-[70vh] overflow-hidden relative">
              <img
                src={activePhoto.imageUrl}
                alt={activePhoto.title || activePhoto.eventName}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain"
              />
              {filteredPhotos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + filteredPhotos.length) % filteredPhotos.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[#090D18]/90 text-white border border-blue-400/40 hover:bg-[#1D4ED8] shadow"
                    aria-label="Previous photo"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex + 1) % filteredPhotos.length)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[#090D18]/90 text-white border border-red-400/40 hover:bg-[#DC2626] shadow"
                    aria-label="Next photo"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {activePhoto.caption && (
              <div className="px-5 py-3.5 text-sm text-slate-200 border-t border-white/10">
                {activePhoto.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

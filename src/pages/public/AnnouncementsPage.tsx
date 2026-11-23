import { useEffect, useState } from 'react';
import { Megaphone, X, ZoomIn } from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { listPublicAnnouncements } from '@/src/services/firebase/announcements';
import { formatDateTime } from '@/src/utils/formatters';
import type { Announcement } from '@/src/types/models';

const CATEGORIES = ['All', 'General', 'Event Update', 'Schedule', 'Result', 'Urgent'];

export function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxNotice, setLightboxNotice] = useState<Announcement | null>(null);

  useEffect(() => {
    let active = true;
    listPublicAnnouncements()
      .then((list) => {
        if (active) setItems(list);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load notices.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visible = category === 'All' ? items : items.filter((i) => i.category === category);

  return (
    <PublicLayout>
      <section className="bg-subpage-arena text-white py-12 border-b border-blue-500/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
            Official Bulletins
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">Notice Board &amp; Announcements</h1>
          <p className="mt-2 text-sm text-slate-300">
            Official Sports Club updates, circular images, match schedules, and reporting guidelines.
          </p>
        </div>
      </section>

      <section className="bg-notices-tint min-h-[60vh]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
          <div className="flex flex-wrap gap-1 p-1.5 card-3d rounded-xl w-fit">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  category === cat
                    ? 'btn-3d-mix'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {error && (
            <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 card-3d rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="card-3d rounded-2xl p-10 text-center text-sm text-slate-300">
              No notices published in this category.
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((ann, idx) => (
                <article
                  key={ann.id}
                  className={`${idx % 2 === 0 ? 'card-3d-blue' : 'card-3d-red'} card-3d-hover rounded-2xl p-6`}
                >
                  <div className="flex flex-col md:flex-row md:items-start gap-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-2">
                        <Megaphone className="w-3.5 h-3.5 text-red-400" />
                        <span className="font-semibold text-blue-300">{ann.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatDateTime(ann.publishAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>Posted by {ann.createdByName}</span>
                      </div>
                      <h2 className="font-display text-xl font-bold text-white">{ann.title}</h2>
                      <p className="mt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                        {ann.body}
                      </p>
                    </div>

                    {ann.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxNotice(ann)}
                        className="group relative w-full md:w-56 shrink-0 rounded-xl overflow-hidden border border-blue-400/30 bg-[#05070C] text-left"
                        title="Click to view full notice image"
                      >
                        <img
                          src={ann.imageUrl}
                          alt={ann.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-40 object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        />
                        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/75 text-[11px] font-semibold text-white">
                          <ZoomIn className="w-3 h-3" />
                          <span>View Notice</span>
                        </span>
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

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
                  {lightboxNotice.category} · {formatDateTime(lightboxNotice.publishAt)}
                </p>
                <h3 className="font-display text-base font-bold text-white truncate">
                  {lightboxNotice.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxNotice(null)}
                className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Close notice image"
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

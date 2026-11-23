import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Eye, EyeOff, ImagePlus, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { ConfirmModal } from '@/src/components/common/ConfirmModal';
import { useAuth } from '@/src/app/AuthContext';
import { listAllEventsForAdmin } from '@/src/services/firebase/events';
import {
  deleteEventPhoto,
  listAllPhotosForAdmin,
  saveEventPhoto,
  toggleEventPhotoPublished,
} from '@/src/services/firebase/photos';
import { compressImageFile } from '@/src/utils/imageUpload';
import { formatDateTime } from '@/src/utils/formatters';
import type { EventPhoto, SportEvent } from '@/src/types/models';

export function AdminPhotosPage() {
  const { adminProfile } = useAuth();
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [photos, setPhotos] = useState<EventPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Upload form
  const [eventId, setEventId] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [published, setPublished] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Filter & delete confirmation
  const [filterEventId, setFilterEventId] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<EventPhoto | null>(null);

  const loadData = useCallback(async () => {
    if (!adminProfile) return;
    setLoading(true);
    try {
      const [evList, photoList] = await Promise.all([
        listAllEventsForAdmin(adminProfile),
        listAllPhotosForAdmin(adminProfile),
      ]);
      setEvents(evList);
      setPhotos(photoList);
      if (evList.length > 0 && !eventId) {
        setEventId(evList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load events and photos.');
    } finally {
      setLoading(false);
    }
  }, [adminProfile, eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleMultiFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (!files.length || !adminProfile) return;

    const chosenEvent = events.find((ev) => ev.id === eventId);
    if (!chosenEvent) {
      setError('Select an event before uploading photos.');
      return;
    }

    setError(null);
    setNotice(null);
    setUploading(true);
    let successCount = 0;

    try {
      for (const file of files.slice(0, 10)) {
        const compressed = await compressImageFile(file, {
          maxWidth: 1280,
          maxHeight: 960,
          maxChars: 350000,
        });
        const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        await saveEventPhoto(
          {
            eventId: chosenEvent.id,
            eventName: chosenEvent.name,
            title: title.trim() || baseName || `${chosenEvent.name} Highlight`,
            caption: caption.trim(),
            imageUrl: compressed,
            published,
          },
          adminProfile
        );
        successCount += 1;
      }
      setTitle('');
      setCaption('');
      setNotice(`Uploaded ${successCount} photo(s) to ${chosenEvent.name}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload selected image(s).');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile) return;
    const chosenEvent = events.find((ev) => ev.id === eventId);
    if (!chosenEvent) {
      setError('Please select an event first.');
      return;
    }
    if (!imageUrlInput.trim()) {
      setError('Enter an HTTPS image URL or use Upload Photos button above.');
      return;
    }

    setError(null);
    setNotice(null);
    setUploading(true);
    try {
      await saveEventPhoto(
        {
          eventId: chosenEvent.id,
          eventName: chosenEvent.name,
          title: title.trim() || `${chosenEvent.name} Photo`,
          caption: caption.trim(),
          imageUrl: imageUrlInput.trim(),
          published,
        },
        adminProfile
      );
      setTitle('');
      setCaption('');
      setImageUrlInput('');
      setNotice(`Added photo link to ${chosenEvent.name}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save photo URL.');
    } finally {
      setUploading(false);
    }
  };

  const handleTogglePublished = async (photo: EventPhoto) => {
    if (!adminProfile) return;
    try {
      await toggleEventPhotoPublished(photo, !photo.published, adminProfile);
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, published: !photo.published } : p))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update photo status.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!adminProfile || !deleteTarget) return;
    try {
      await deleteEventPhoto(deleteTarget, adminProfile);
      setPhotos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
      setNotice('Event photo removed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete photo.');
    }
  };

  const visiblePhotos = useMemo(() => {
    if (filterEventId === 'all') return photos;
    return photos.filter((p) => p.eventId === filterEventId);
  }, [photos, filterEventId]);

  return (
    <AdminLayout title="Event Photo Gallery Manager" breadcrumb="Admin / Event Photos">
      <div className="space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm">
            {notice}
          </div>
        )}

        {/* Upload Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold text-[#142D50]">
              Upload Photos by Event
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Published photos appear automatically on the public Photos page (/photos), the Event
              Detail page, and the Homepage Photo Gallery directly above the Footer.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ph-event" className="block text-xs font-medium text-slate-700 mb-1">
                Select Event *
              </label>
              <select
                id="ph-event"
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                {events.length === 0 && <option value="">No events available</option>}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ph-title" className="block text-xs font-medium text-slate-700 mb-1">
                Photo Title (Optional — uses filename if blank)
              </label>
              <input
                id="ph-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Cricket Final Opening Toss"
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ph-cap" className="block text-xs font-medium text-slate-700 mb-1">
              Caption / Description (Optional)
            </label>
            <input
              id="ph-cap"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Short description shown under the photograph"
              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              <span>Publish immediately to public gallery &amp; homepage</span>
            </label>

            <label
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] cursor-pointer ${
                uploading || events.length === 0 ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <ImagePlus className="w-4 h-4 text-[#F28C28]" />
              <span>{uploading ? 'Compressing & Uploading...' : 'Upload Photo File(s)'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploading || events.length === 0}
                onChange={(e) => void handleMultiFileUpload(e)}
                className="hidden"
              />
            </label>
          </div>

          <form
            onSubmit={(e) => void handleUrlSubmit(e)}
            className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-3"
          >
            <input
              type="url"
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="Or paste an external HTTPS image URL (https://...)"
              className="flex-1 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={uploading || events.length === 0}
              className="px-4 py-2 text-xs font-semibold text-[#142D50] bg-[#F28C28] rounded-lg hover:bg-[#f79d42] disabled:opacity-60 whitespace-nowrap"
            >
              Save Image URL
            </button>
          </form>
        </div>

        {/* Gallery Grid */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold text-[#142D50]">
              Uploaded Event Photos ({visiblePhotos.length})
            </h2>
            <select
              value={filterEventId}
              onChange={(e) => setFilterEventId(e.target.value)}
              aria-label="Filter photos by event"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-900"
            >
              <option value="all">All Events ({photos.length})</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-56 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : visiblePhotos.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
              <Camera className="w-7 h-7 text-slate-400 mx-auto mb-2" />
              No event photos uploaded yet for this filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {visiblePhotos.map((photo) => (
                <article
                  key={photo.id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-[#F4F6F8]/50 flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[16/10] bg-[#142D50] relative">
                      <img
                        src={photo.imageUrl}
                        alt={photo.title || photo.eventName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          photo.published
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-700 text-white'
                        }`}
                      >
                        {photo.published ? 'Published' : 'Hidden'}
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] font-semibold text-[#F28C28]">{photo.eventName}</p>
                      <h3 className="mt-0.5 font-display text-sm font-bold text-[#142D50] truncate">
                        {photo.title || photo.eventName}
                      </h3>
                      {photo.caption && (
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2">{photo.caption}</p>
                      )}
                      <p className="mt-2 text-[11px] text-slate-400 tabular-nums">
                        {formatDateTime(photo.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void handleTogglePublished(photo)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#142D50] hover:underline"
                    >
                      {photo.published ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(photo)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Event Photo?"
        description={`Are you sure you want to delete "${deleteTarget?.title || 'this photo'}" from ${deleteTarget?.eventName}?`}
        confirmLabel="Delete Photo"
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </AdminLayout>
  );
}

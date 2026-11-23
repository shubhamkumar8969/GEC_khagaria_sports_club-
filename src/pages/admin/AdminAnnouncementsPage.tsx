import React, { useCallback, useEffect, useState } from 'react';
import { Edit, ImagePlus, Plus, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { ConfirmModal } from '@/src/components/common/ConfirmModal';
import { useAuth } from '@/src/app/AuthContext';
import {
  deleteAnnouncement,
  listAllAnnouncements,
  saveAnnouncement,
} from '@/src/services/firebase/announcements';
import { compressImageFile } from '@/src/utils/imageUpload';
import { formatDateTime, toLocalDateTimeInputValue } from '@/src/utils/formatters';
import type {
  Announcement,
  AnnouncementCategory,
  AnnouncementStatus,
} from '@/src/types/models';

export function AdminAnnouncementsPage() {
  const { adminProfile } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('General');
  const [status, setStatus] = useState<AnnouncementStatus>('published');
  const [publishAt, setPublishAt] = useState(() => toLocalDateTimeInputValue(null, 0));
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listAllAnnouncements();
      setItems(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load notices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingId(undefined);
    setTitle('');
    setBody('');
    setCategory('General');
    setStatus('published');
    setPublishAt(toLocalDateTimeInputValue(null, 0));
    setImageUrl('');
  };

  const handleEdit = (ann: Announcement) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setBody(ann.body);
    setCategory(ann.category);
    setStatus(ann.status);
    setPublishAt(toLocalDateTimeInputValue(ann.publishAt));
    setImageUrl(ann.imageUrl || '');
    setSuccessMsg(null);
    setError(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploadingImage(true);
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1280,
        maxHeight: 1280,
        maxChars: 350000,
      });
      setImageUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process selected notice image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile || !title.trim() || !body.trim()) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await saveAnnouncement(
        {
          id: editingId,
          title,
          body,
          category,
          eventId: '',
          imageUrl,
          status,
          publishAt: new Date(publishAt),
        },
        adminProfile
      );
      setSuccessMsg(editingId ? 'Notice updated successfully.' : 'Notice posted to Notice Board.');
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save notice.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !adminProfile) return;
    try {
      await deleteAnnouncement(deleteTarget, adminProfile);
      setDeleteTarget(null);
      setSuccessMsg('Notice deleted.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete notice.');
    }
  };

  return (
    <AdminLayout title="Notice Board & Announcements" breadcrumb="Admin / Notice Board">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-[#142D50]">
              {editingId ? 'Edit Notice' : 'Post New Notice'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-medium text-[#142D50] hover:underline"
              >
                Create New Instead
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs">
              {successMsg}
            </div>
          )}

          <div>
            <label htmlFor="ann-title" className="block text-xs font-semibold text-slate-700 mb-1">
              Notice Title *
            </label>
            <input
              id="ann-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. UMANG Cricket Match Schedule"
              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ann-cat" className="block text-xs font-semibold text-slate-700 mb-1">
                Notice Type
              </label>
              <select
                id="ann-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white text-slate-900"
              >
                <option value="General">General Notice</option>
                <option value="Event Update">Event Update</option>
                <option value="Schedule">Match Schedule</option>
                <option value="Result">Result Notice</option>
                <option value="Urgent">Urgent Notice</option>
              </select>
            </div>

            <div>
              <label htmlFor="ann-status" className="block text-xs font-semibold text-slate-700 mb-1">
                Show to Students?
              </label>
              <select
                id="ann-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as AnnouncementStatus)}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm bg-white text-slate-900"
              >
                <option value="published">Published (Visible)</option>
                <option value="draft">Draft (Hidden)</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ann-date" className="block text-xs font-semibold text-slate-700 mb-1">
              Notice Date &amp; Time
            </label>
            <input
              id="ann-date"
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="ann-body" className="block text-xs font-semibold text-slate-700 mb-1">
              Notice Message / Details *
            </label>
            <textarea
              id="ann-body"
              rows={4}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write full notice details, match timings, or reporting instructions..."
              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
            />
          </div>

          {/* Notice Photo / Circular Image */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Notice Photo / Circular Image (Optional)
              </span>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] cursor-pointer">
                <ImagePlus className="w-3.5 h-3.5 text-[#F28C28]" />
                <span>{uploadingImage ? 'Uploading...' : 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={uploadingImage}
                  onChange={(e) => void handleImageUpload(e)}
                  className="hidden"
                />
              </label>
            </div>

            {imageUrl && (
              <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-white">
                <img
                  src={imageUrl}
                  alt="Notice attachment preview"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-48 object-contain bg-slate-100"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              </div>
            )}

            <input
              type="url"
              value={imageUrl.startsWith('data:') ? '' : imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder={
                imageUrl.startsWith('data:')
                  ? 'Uploaded notice image attached (click Remove to change)'
                  : 'Or paste image link (https://...)'
              }
              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-1.5 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={saving || uploadingImage}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-60"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'Saving...' : editingId ? 'Update Notice' : 'Post Notice'}</span>
          </button>
        </form>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-bold text-[#142D50]">
              Posted Notices ({items.length})
            </h2>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading notices...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No notices posted yet. Use the form on the left to post a text or photo notice.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((ann) => (
                <div key={ann.id} className="p-5 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {ann.imageUrl && (
                      <img
                        src={ann.imageUrl}
                        alt={ann.title}
                        referrerPolicy="no-referrer"
                        className="w-20 h-20 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-1">
                        <StatusTag status={ann.status} />
                        <span>{ann.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatDateTime(ann.publishAt)}</span>
                      </div>
                      <h3 className="font-display text-base font-bold text-[#142D50]">{ann.title}</h3>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">{ann.body}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEdit(ann)}
                      className="p-1.5 text-slate-600 hover:text-[#142D50]"
                      title="Edit notice"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {adminProfile?.role === 'super_admin' && (
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(ann)}
                        className="p-1.5 text-red-600 hover:text-red-800"
                        title="Delete notice"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Notice"
        description={`Permanently delete "${deleteTarget?.title}" from the Notice Board?`}
        confirmLabel="Delete"
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </AdminLayout>
  );
}

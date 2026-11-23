import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, ImagePlus, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { useAuth } from '@/src/app/AuthContext';
import { getEventById, saveEvent } from '@/src/services/firebase/events';
import { eventFormSchema, slugify } from '@/src/schemas/validation';
import { compressImageFile } from '@/src/utils/imageUpload';
import { toLocalDateTimeInputValue } from '@/src/utils/formatters';
import type { EventStatus } from '@/src/types/models';

const PUBLISHING_MODES: Array<{ value: EventStatus; label: string; hint: string }> = [
  {
    value: 'registration_open',
    label: 'Publish Live & Open Registration',
    hint: 'Featured live on homepage & students can register online.',
  },
  {
    value: 'published',
    label: 'Publish Live Showcase',
    hint: 'Visible live in Events & Live Event Showcase before registration opens.',
  },
  {
    value: 'ongoing',
    label: 'Live / Ongoing Tournament',
    hint: 'Displayed live as active competition in progress.',
  },
  {
    value: 'draft',
    label: 'Draft (Hidden)',
    hint: 'Visible only to administrators.',
  },
  {
    value: 'registration_closed',
    label: 'Registration Closed',
    hint: 'Publicly visible, form submissions locked.',
  },
  {
    value: 'completed',
    label: 'Completed',
    hint: 'Archive fixtures and highlight winners & certificates.',
  },
  {
    value: 'archived',
    label: 'Archived',
    hint: 'Removed from active public listings.',
  },
];

export function AdminEventEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = Boolean(id);
  const { adminProfile } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [highlightsText, setHighlightsText] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [venue, setVenue] = useState('');
  const [startAt, setStartAt] = useState(() => toLocalDateTimeInputValue(null, 14));
  const [endAt, setEndAt] = useState(() => toLocalDateTimeInputValue(null, 18));
  const [registrationStartAt, setRegistrationStartAt] = useState(() =>
    toLocalDateTimeInputValue(null, 0)
  );
  const [registrationEndAt, setRegistrationEndAt] = useState(() =>
    toLocalDateTimeInputValue(null, 12)
  );
  const [status, setStatus] = useState<EventStatus>('registration_open');
  const [featured, setFeatured] = useState(true);
  const [autoApprove, setAutoApprove] = useState(true);
  const [showPublicResults, setShowPublicResults] = useState(true);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    getEventById(id)
      .then((evt) => {
        if (!active || !evt) return;
        setName(evt.name);
        setSlug(evt.slug);
        setShortDescription(evt.shortDescription);
        setDescription(evt.description);
        setHighlightsText(evt.highlightsText || '');
        setBannerUrl(evt.bannerUrl);
        setVenue(evt.venue);
        setStartAt(toLocalDateTimeInputValue(evt.startAt));
        setEndAt(toLocalDateTimeInputValue(evt.endAt));
        setRegistrationStartAt(toLocalDateTimeInputValue(evt.registrationStartAt));
        setRegistrationEndAt(toLocalDateTimeInputValue(evt.registrationEndAt));
        setStatus(evt.status);
        setFeatured(evt.featured);
        setAutoApprove(evt.autoApprove);
        setShowPublicResults(evt.showPublicResults);
      })
      .catch((err) => {
        if (active) setSubmitError(err instanceof Error ? err.message : 'Unable to load event.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitError(null);
    setUploadingBanner(true);
    try {
      const dataUrl = await compressImageFile(file, {
        maxWidth: 1400,
        maxHeight: 900,
        maxChars: 350000,
      });
      setBannerUrl(dataUrl);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not process selected photo.');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile) return;
    setSubmitError(null);

    const parsed = eventFormSchema.safeParse({
      name,
      slug: slug || slugify(name),
      shortDescription,
      description,
      highlightsText,
      bannerUrl,
      venue,
      startAt,
      endAt,
      registrationStartAt,
      registrationEndAt,
      status,
      featured,
      autoApprove,
      showPublicResults,
    });

    if (!parsed.success) {
      const nextErrs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErrs[String(issue.path[0] || 'form')] = issue.message;
      }
      setErrors(nextErrs);
      return;
    }

    setErrors({});
    setSaving(true);
    try {
      const savedId = await saveEvent(
        {
          id,
          name: parsed.data.name,
          slug: parsed.data.slug,
          shortDescription: parsed.data.shortDescription,
          description: parsed.data.description,
          highlightsText: parsed.data.highlightsText,
          bannerUrl: parsed.data.bannerUrl,
          venue: parsed.data.venue,
          startAt: new Date(parsed.data.startAt),
          endAt: new Date(parsed.data.endAt),
          registrationStartAt: new Date(parsed.data.registrationStartAt),
          registrationEndAt: new Date(parsed.data.registrationEndAt),
          status: parsed.data.status,
          featured: parsed.data.featured,
          autoApprove: parsed.data.autoApprove,
          showPublicResults: parsed.data.showPublicResults,
        },
        adminProfile
      );
      navigate(`/admin/events/${savedId}/games`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout
      title={isEditing ? `Edit Event: ${name || '...'}` : 'Create New Event'}
      breadcrumb="Admin / Events / Editor"
    >
      <div className="max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/admin/events"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#142D50]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Events</span>
          </Link>
          <Link
            to="/admin/photos"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#142D50] bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Camera className="w-3.5 h-3.5 text-[#F28C28]" />
            <span>Upload Multiple Event Photos</span>
          </Link>
        </div>

        {loading ? (
          <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-8"
          >
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4 text-sm">
                {submitError}
              </div>
            )}

            {/* Publishing Mode Selector */}
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#142D50]">
                  1. Event Visibility &amp; Registration Status
                </h2>
                <p className="text-xs text-slate-600">
                  Choose whether this event appears live on the homepage and allows students to register.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {PUBLISHING_MODES.map((mode) => {
                  const selected = status === mode.value;
                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => setStatus(mode.value)}
                      className={`p-3 rounded-xl border text-left transition-colors ${
                        selected
                          ? 'border-[#142D50] bg-[#142D50] text-white'
                          : 'border-slate-200 bg-[#F4F6F8]/60 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold">{mode.label}</span>
                        {selected && <CheckCircle2 className="w-4 h-4 text-[#F28C28] shrink-0" />}
                      </div>
                      <p
                        className={`mt-1 text-[11px] leading-snug ${
                          selected ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {mode.hint}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Core Identity & Content */}
            <section className="space-y-4 pt-6 border-t border-slate-100">
              <h2 className="font-display text-base font-bold text-[#142D50]">
                2. Event Title, Summary &amp; User Content
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="evt-name" className="block text-xs font-semibold text-slate-800 mb-1">
                    Event Name *
                  </label>
                  <input
                    id="evt-name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!isEditing) setSlug(slugify(e.target.value));
                    }}
                    placeholder="e.g. UMANG'27"
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="evt-slug" className="block text-xs font-semibold text-slate-800 mb-1">
                    Short Web Link Name *
                  </label>
                  <input
                    id="evt-slug"
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    placeholder="umang-27"
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm font-mono"
                  />
                  {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="evt-short" className="block text-xs font-semibold text-slate-800 mb-1">
                  Short One-Line Summary *
                </label>
                <input
                  id="evt-short"
                  type="text"
                  value={shortDescription}
                  onChange={(e) => setShortDescription(e.target.value)}
                  placeholder="Brief summary shown on the event card"
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
                {errors.shortDescription && (
                  <p className="mt-1 text-xs text-red-600">{errors.shortDescription}</p>
                )}
              </div>

              <div>
                <label htmlFor="evt-desc" className="block text-xs font-semibold text-slate-800 mb-1">
                  Full Event Description
                </label>
                <textarea
                  id="evt-desc"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the tournament, participating branches, and awards..."
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="evt-highlights" className="block text-xs font-semibold text-slate-800 mb-1">
                  Schedule, Reporting Time &amp; Important Instructions
                </label>
                <textarea
                  id="evt-highlights"
                  rows={4}
                  value={highlightsText}
                  onChange={(e) => setHighlightsText(e.target.value)}
                  placeholder="Example: Day 1: Opening Ceremony 8:30 AM · Reporting Time: 30 mins prior with College ID Card · Trophies & Certificates for all finalists."
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </section>

            {/* Banner Photo Section */}
            <section className="space-y-4 pt-6 border-t border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[#142D50]">
                    3. Event Cover Photo / Banner
                  </h2>
                  <p className="text-xs text-slate-500">
                    Upload a banner photo directly or paste an approved HTTPS image link.
                  </p>
                </div>
                <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] cursor-pointer">
                  <ImagePlus className="w-4 h-4 text-[#F28C28]" />
                  <span>{uploadingBanner ? 'Compressing...' : 'Upload Event Banner Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => void handleBannerUpload(e)}
                    className="hidden"
                  />
                </label>
              </div>

              {bannerUrl && (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                  <img
                    src={bannerUrl}
                    alt="Event banner preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-52 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    className="absolute top-3 right-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-red-600/90 rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Photo</span>
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="evt-banner" className="block text-xs font-semibold text-slate-800 mb-1">
                  Or Image Link (Optional)
                </label>
                <input
                  id="evt-banner"
                  type="text"
                  value={bannerUrl.startsWith('data:') ? '' : bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder={
                    bannerUrl.startsWith('data:')
                      ? 'Uploaded image attached (click Remove Photo to replace with link)'
                      : 'https://... or leave blank for official Sports Club banner'
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </section>

            {/* Venue & Dates */}
            <section className="space-y-4 pt-6 border-t border-slate-100">
              <h2 className="font-display text-base font-bold text-[#142D50]">
                4. Venue, Event Dates &amp; Registration Dates
              </h2>
              <div>
                <label htmlFor="evt-venue" className="block text-xs font-semibold text-slate-800 mb-1">
                  Event Ground / Venue
                </label>
                <input
                  id="evt-venue"
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. GEC Khagaria Main Sports Ground"
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="evt-start" className="block text-xs font-semibold text-slate-800 mb-1">
                    Event Start Date &amp; Time *
                  </label>
                  <input
                    id="evt-start"
                    type="datetime-local"
                    value={startAt}
                    onChange={(e) => setStartAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="evt-end" className="block text-xs font-semibold text-slate-800 mb-1">
                    Event End Date &amp; Time *
                  </label>
                  <input
                    id="evt-end"
                    type="datetime-local"
                    value={endAt}
                    onChange={(e) => setEndAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
                  />
                  {errors.endAt && <p className="mt-1 text-xs text-red-600">{errors.endAt}</p>}
                </div>
                <div>
                  <label
                    htmlFor="evt-reg-start"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Registration Opens *
                  </label>
                  <input
                    id="evt-reg-start"
                    type="datetime-local"
                    value={registrationStartAt}
                    onChange={(e) => setRegistrationStartAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label
                    htmlFor="evt-reg-end"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Registration Closes *
                  </label>
                  <input
                    id="evt-reg-end"
                    type="datetime-local"
                    value={registrationEndAt}
                    onChange={(e) => setRegistrationEndAt(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
                  />
                  {errors.registrationEndAt && (
                    <p className="mt-1 text-xs text-red-600">{errors.registrationEndAt}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                  />
                  <span>Show this event prominently on the Home page</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoApprove}
                    onChange={(e) => setAutoApprove(e.target.checked)}
                  />
                  <span>Confirm student registrations immediately upon submission (No admin approval required)</span>
                </label>
                <label className="flex items-center gap-2.5 text-sm text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPublicResults}
                    onChange={(e) => setShowPublicResults(e.target.checked)}
                  />
                  <span>Show results on the public Results page when ready</span>
                </label>
              </div>
            </section>

            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <Link
                to="/admin/events"
                className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving || uploadingBanner}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-60"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Changes & Manage Games' : 'Publish & Add Games'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}

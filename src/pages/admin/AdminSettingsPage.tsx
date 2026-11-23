import React, { useEffect, useState } from 'react';
import { Award, Database, LayoutTemplate, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { saveSiteSettings } from '@/src/services/firebase/settings';
import { seedDemoUmang27 } from '@/src/services/firebase/demoSeeder';
import type { ClubHighlightItem, SectionVisibilitySettings } from '@/src/types/models';

export function AdminSettingsPage() {
  const { adminProfile } = useAuth();
  const { settings, refreshSettings } = useSiteSettings();

  // Identity & Contact
  const [clubName, setClubName] = useState(settings.clubName);
  const [institutionName, setInstitutionName] = useState(settings.institutionName);
  const [tagline, setTagline] = useState(settings.tagline);
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [contactPhone, setContactPhone] = useState(settings.contactPhone);
  const [campusAddress, setCampusAddress] = useState(settings.campusAddress);
  const [facultyCoordinator, setFacultyCoordinator] = useState(settings.facultyCoordinator);
  const [studentCoordinator, setStudentCoordinator] = useState(settings.studentCoordinator);
  const [branchesText, setBranchesText] = useState(settings.branches.join(', '));
  const [yearsText, setYearsText] = useState(settings.years.join(', '));
  const [privacyText, setPrivacyText] = useState(settings.privacyText);
  const [showPublicResults, setShowPublicResults] = useState(settings.showPublicResults);

  // Dynamic Hero & 3D Showcase Copy
  const [heroEyebrow, setHeroEyebrow] = useState(settings.heroEyebrow);
  const [heroTitle, setHeroTitle] = useState(settings.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(settings.heroSubtitle);
  const [heroCtaLabel, setHeroCtaLabel] = useState(settings.heroCtaLabel);
  const [showcaseTitle, setShowcaseTitle] = useState(settings.showcaseTitle);
  const [showcaseSubtitle, setShowcaseSubtitle] = useState(settings.showcaseSubtitle);

  // Dynamic About & Pillars
  const [aboutMissionTitle, setAboutMissionTitle] = useState(settings.aboutMissionTitle);
  const [aboutMissionBody, setAboutMissionBody] = useState(settings.aboutMissionBody);
  const [aboutHighlights, setAboutHighlights] = useState<ClubHighlightItem[]>(
    settings.aboutHighlights
  );

  // Dynamic Certificate Branding
  const [certificateAuthorityTitle, setCertificateAuthorityTitle] = useState(
    settings.certificateAuthorityTitle
  );
  const [certificateHeaderSubtitle, setCertificateHeaderSubtitle] = useState(
    settings.certificateHeaderSubtitle
  );
  const [certificateFooterNote, setCertificateFooterNote] = useState(
    settings.certificateFooterNote
  );

  // Homepage Section Visibility
  const [sectionVisibility, setSectionVisibility] = useState<SectionVisibilitySettings>(
    settings.sectionVisibility
  );

  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setClubName(settings.clubName);
    setInstitutionName(settings.institutionName);
    setTagline(settings.tagline);
    setContactEmail(settings.contactEmail);
    setContactPhone(settings.contactPhone);
    setCampusAddress(settings.campusAddress);
    setFacultyCoordinator(settings.facultyCoordinator);
    setStudentCoordinator(settings.studentCoordinator);
    setBranchesText(settings.branches.join(', '));
    setYearsText(settings.years.join(', '));
    setPrivacyText(settings.privacyText);
    setShowPublicResults(settings.showPublicResults);

    setHeroEyebrow(settings.heroEyebrow);
    setHeroTitle(settings.heroTitle);
    setHeroSubtitle(settings.heroSubtitle);
    setHeroCtaLabel(settings.heroCtaLabel);
    setShowcaseTitle(settings.showcaseTitle);
    setShowcaseSubtitle(settings.showcaseSubtitle);

    setAboutMissionTitle(settings.aboutMissionTitle);
    setAboutMissionBody(settings.aboutMissionBody);
    setAboutHighlights(settings.aboutHighlights);

    setCertificateAuthorityTitle(settings.certificateAuthorityTitle);
    setCertificateHeaderSubtitle(settings.certificateHeaderSubtitle);
    setCertificateFooterNote(settings.certificateFooterNote);

    setSectionVisibility(settings.sectionVisibility);
  }, [settings]);

  const handleToggleSection = (key: keyof SectionVisibilitySettings) => {
    setSectionVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleUpdateHighlight = (index: number, field: keyof ClubHighlightItem, value: string) => {
    setAboutHighlights((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  };

  const handleAddHighlight = () => {
    if (aboutHighlights.length >= 8) return;
    setAboutHighlights((prev) => [
      ...prev,
      { title: 'New Club Pillar', description: 'Describe this Sports Club feature or facility.' },
    ]);
  };

  const handleRemoveHighlight = (index: number) => {
    setAboutHighlights((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    const branches = branchesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    const years = yearsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (branches.length === 0 || years.length === 0) {
      setError('At least one academic branch and one year option are required.');
      setSaving(false);
      return;
    }

    const cleanHighlights = aboutHighlights
      .map((h) => ({
        title: h.title.trim().slice(0, 120),
        description: h.description.trim().slice(0, 400),
      }))
      .filter((h) => h.title.length > 0 && h.description.length > 0)
      .slice(0, 8);

    try {
      await saveSiteSettings(
        {
          clubName: clubName.trim().slice(0, 150),
          institutionName: institutionName.trim().slice(0, 200),
          tagline: tagline.trim().slice(0, 250),
          heroEyebrow: heroEyebrow.trim().slice(0, 120),
          heroTitle: heroTitle.trim().slice(0, 160),
          heroSubtitle: heroSubtitle.trim().slice(0, 400),
          heroCtaLabel: heroCtaLabel.trim().slice(0, 60) || 'Explore Events',
          showcaseTitle: showcaseTitle.trim().slice(0, 140),
          showcaseSubtitle: showcaseSubtitle.trim().slice(0, 300),
          aboutMissionTitle: aboutMissionTitle.trim().slice(0, 140),
          aboutMissionBody: aboutMissionBody.trim().slice(0, 2000),
          aboutHighlights: cleanHighlights,
          certificateAuthorityTitle: certificateAuthorityTitle.trim().slice(0, 120),
          certificateHeaderSubtitle: certificateHeaderSubtitle.trim().slice(0, 160),
          certificateFooterNote: certificateFooterNote.trim().slice(0, 300),
          sectionVisibility,
          contactEmail: contactEmail.trim().slice(0, 200),
          contactPhone: contactPhone.trim().slice(0, 40),
          campusAddress: campusAddress.trim().slice(0, 400),
          facultyCoordinator: facultyCoordinator.trim().slice(0, 150),
          studentCoordinator: studentCoordinator.trim().slice(0, 150),
          branches,
          years,
          privacyText: privacyText.trim().slice(0, 3000),
          showPublicResults,
        },
        adminProfile
      );
      await refreshSettings();
      setNotice('Dynamic website CMS, hero copy, sections, certificates, and settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save site settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedDemo = async () => {
    if (!adminProfile) return;
    setSeeding(true);
    setError(null);
    setNotice(null);
    try {
      await seedDemoUmang27(adminProfile);
      await refreshSettings();
      setNotice(
        "Sample UMANG'27 event with 6 games, notices, and 3 Results Panel champions seeded in Firestore."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to seed sample data.');
    } finally {
      setSeeding(false);
    }
  };

  const sectionToggleList: Array<{ key: keyof SectionVisibilitySettings; label: string }> = [
    { key: 'showHero3D', label: 'Hero Live Event Showcase Section' },
    { key: 'showMetrics', label: 'Live Club Telemetry Strip (Events / Games / Photos)' },
    { key: 'showEvents', label: 'Featured Events & Tournaments Grid' },
    { key: 'showResults', label: 'Public Podium Results Panel Preview' },
    { key: 'showHighlights', label: 'Dynamic Club Highlights & Pillars Grid' },
    { key: 'showAnnouncements', label: 'Latest Notices & Schedule Updates' },
    { key: 'showPhotoGallery', label: 'Event Photo Gallery (Above Footer)' },
    { key: 'showPortalCta', label: 'Student Login & Certificate Hub Banner' },
  ];

  return (
    <AdminLayout title="Website CMS & Club Settings" breadcrumb="Admin / Settings" requireSuperAdmin>
      <div className="max-w-5xl space-y-8">
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

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
          {/* Card 1: Club Identity & Contact */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#142D50]">
              1. Official Club Identity, Contacts & Eligibility Options
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="set-club" className="block text-xs font-medium text-slate-700 mb-1">
                  Club Name *
                </label>
                <input
                  id="set-club"
                  type="text"
                  required
                  value={clubName}
                  onChange={(e) => setClubName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="set-inst" className="block text-xs font-medium text-slate-700 mb-1">
                  Institution Name *
                </label>
                <input
                  id="set-inst"
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="set-tag" className="block text-xs font-medium text-slate-700 mb-1">
                Club Tagline
              </label>
              <input
                id="set-tag"
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="set-email" className="block text-xs font-medium text-slate-700 mb-1">
                  Official Contact Email
                </label>
                <input
                  id="set-email"
                  type="text"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="set-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  Official Contact Phone
                </label>
                <input
                  id="set-phone"
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="set-fac" className="block text-xs font-medium text-slate-700 mb-1">
                  Faculty Sports Coordinator (Also on Certificates)
                </label>
                <input
                  id="set-fac"
                  type="text"
                  value={facultyCoordinator}
                  onChange={(e) => setFacultyCoordinator(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="set-stu" className="block text-xs font-medium text-slate-700 mb-1">
                  Student Sports Secretary (Also on Certificates)
                </label>
                <input
                  id="set-stu"
                  type="text"
                  value={studentCoordinator}
                  onChange={(e) => setStudentCoordinator(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="set-addr" className="block text-xs font-medium text-slate-700 mb-1">
                Campus Office Address
              </label>
              <input
                id="set-addr"
                type="text"
                value={campusAddress}
                onChange={(e) => setCampusAddress(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="set-branches"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Branch Options (comma-separated) *
                </label>
                <input
                  id="set-branches"
                  type="text"
                  required
                  value={branchesText}
                  onChange={(e) => setBranchesText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="set-years" className="block text-xs font-medium text-slate-700 mb-1">
                  Year Options (comma-separated) *
                </label>
                <input
                  id="set-years"
                  type="text"
                  required
                  value={yearsText}
                  onChange={(e) => setYearsText(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="set-priv" className="block text-xs font-medium text-slate-700 mb-1">
                Registration Privacy Notice
              </label>
              <textarea
                id="set-priv"
                rows={2}
                value={privacyText}
                onChange={(e) => setPrivacyText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>

            <label className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showPublicResults}
                onChange={(e) => setShowPublicResults(e.target.checked)}
              />
              <span>Allow public results summaries by default on completed events</span>
            </label>
          </div>

          {/* Card 2: Hero & Live Showcase Copy */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#F28C28]" />
              <h2 className="font-display text-lg font-bold text-[#142D50]">
                2. Hero Banner &amp; Live Event Showcase Labels
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="set-hero-eye" className="block text-xs font-medium text-slate-700 mb-1">
                  Hero Eyebrow Label
                </label>
                <input
                  id="set-hero-eye"
                  type="text"
                  value={heroEyebrow}
                  onChange={(e) => setHeroEyebrow(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="set-hero-cta" className="block text-xs font-medium text-slate-700 mb-1">
                  Hero Primary Button Text
                </label>
                <input
                  id="set-hero-cta"
                  type="text"
                  value={heroCtaLabel}
                  onChange={(e) => setHeroCtaLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="set-hero-title" className="block text-xs font-medium text-slate-700 mb-1">
                Hero Main Headline
              </label>
              <input
                id="set-hero-title"
                type="text"
                value={heroTitle}
                onChange={(e) => setHeroTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="set-hero-sub" className="block text-xs font-medium text-slate-700 mb-1">
                Hero Supporting Description
              </label>
              <textarea
                id="set-hero-sub"
                rows={2}
                value={heroSubtitle}
                onChange={(e) => setHeroSubtitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="set-3d-title" className="block text-xs font-medium text-slate-700 mb-1">
                  Live Event Showcase Badge Title
                </label>
                <input
                  id="set-3d-title"
                  type="text"
                  value={showcaseTitle}
                  onChange={(e) => setShowcaseTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="set-3d-sub" className="block text-xs font-medium text-slate-700 mb-1">
                  Showcase Fallback Caption (When 0 Events)
                </label>
                <input
                  id="set-3d-sub"
                  type="text"
                  value={showcaseSubtitle}
                  onChange={(e) => setShowcaseSubtitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Homepage Section Visibility */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-[#F28C28]" />
              <h2 className="font-display text-lg font-bold text-[#142D50]">
                3. Homepage Section Visibility Toggles
              </h2>
            </div>
            <p className="text-xs text-slate-600">
              Show or hide sections dynamically across the public homepage without touching code.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {sectionToggleList.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50/70 text-sm text-slate-800 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={sectionVisibility[item.key]}
                    onChange={() => handleToggleSection(item.key)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Card 4: Dynamic Mission & Club Pillars */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#142D50]">
                4. About Mission & Dynamic Club Pillars ({aboutHighlights.length}/8)
              </h2>
              {aboutHighlights.length < 8 && (
                <button
                  type="button"
                  onClick={handleAddHighlight}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#142D50] border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Pillar</span>
                </button>
              )}
            </div>

            <div>
              <label htmlFor="set-miss-title" className="block text-xs font-medium text-slate-700 mb-1">
                About / Mission Section Heading
              </label>
              <input
                id="set-miss-title"
                type="text"
                value={aboutMissionTitle}
                onChange={(e) => setAboutMissionTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="set-miss-body" className="block text-xs font-medium text-slate-700 mb-1">
                About / Mission Paragraph
              </label>
              <textarea
                id="set-miss-body"
                rows={3}
                value={aboutMissionBody}
                onChange={(e) => setAboutMissionBody(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-3">
              {aboutHighlights.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[#142D50]">
                      Pillar #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHighlight(idx)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => handleUpdateHighlight(idx, 'title', e.target.value)}
                      placeholder="Pillar Title"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-400"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => handleUpdateHighlight(idx, 'description', e.target.value)}
                      placeholder="Short description..."
                      className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 5: Certificate Authority Template */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#F28C28]" />
              <h2 className="font-display text-lg font-bold text-[#142D50]">
                5. Official Certificate Template Text
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="set-cert-auth" className="block text-xs font-medium text-slate-700 mb-1">
                  Faculty Signatory Designation
                </label>
                <input
                  id="set-cert-auth"
                  type="text"
                  value={certificateAuthorityTitle}
                  onChange={(e) => setCertificateAuthorityTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="set-cert-sub" className="block text-xs font-medium text-slate-700 mb-1">
                  Certificate Header Subtitle
                </label>
                <input
                  id="set-cert-sub"
                  type="text"
                  value={certificateHeaderSubtitle}
                  onChange={(e) => setCertificateHeaderSubtitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label htmlFor="set-cert-foot" className="block text-xs font-medium text-slate-700 mb-1">
                Certificate Footer Verification Note
              </label>
              <input
                id="set-cert-foot"
                type="text"
                value={certificateFooterNote}
                onChange={(e) => setCertificateFooterNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-60"
            >
              {saving ? 'Saving Website CMS...' : 'Save All Dynamic Settings'}
            </button>
          </div>
        </form>

        {/* Initial Setup / Demo Seeder */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#142D50]">
              UMANG&apos;27 Starter Template (Development / Testing)
            </h2>
            <p className="mt-1 text-xs text-slate-600 max-w-xl">
              Creates a complete sample event (UMANG&apos;27) with Cricket, Volleyball, Kabaddi,
              Football, Badminton Doubles, and Chess, announcements, plus sample Results Panel
              podium entries in Firestore.
            </p>
          </div>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void handleSeedDemo()}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#F28C28] rounded-lg hover:bg-[#dc7a1b] disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Database className="w-4 h-4" />
            <span>{seeding ? 'Creating...' : "Seed UMANG'27 Sample"}</span>
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}

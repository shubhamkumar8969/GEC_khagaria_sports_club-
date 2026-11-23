import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckSquare,
  Download,
  ImagePlus,
  Search,
  Send,
  ShieldCheck,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag, getStatusLabel } from '@/src/components/common/StatusBadge';
import { ConfirmModal } from '@/src/components/common/ConfirmModal';
import { CertificateModal } from '@/src/components/common/CertificateModal';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listAllEventsForAdmin, listAllGames } from '@/src/services/firebase/events';
import { listRegistrationsForAdmin } from '@/src/services/firebase/registrations';
import { listAllStudentProfilesForAdmin } from '@/src/services/firebase/students';
import { savePublishedResult } from '@/src/services/firebase/results';
import {
  buildRecipientFromRegistration,
  buildRecipientFromStudentProfile,
  distributeCertificates,
  listAllCertificatesForAdmin,
  revokeIssuedCertificate,
  type CertificateRecipientInput,
} from '@/src/services/firebase/certificates';
import { normalizeEnrollment } from '@/src/schemas/validation';
import { compressImageFile } from '@/src/utils/imageUpload';
import { downloadCertificatePng, type CertificateData } from '@/src/utils/certificateGenerator';
import { formatDateTime } from '@/src/utils/formatters';
import type {
  CertificatePlacement,
  CertificateType,
  EventGame,
  IssuedCertificate,
  Registration,
  ResultPlacement,
  SportEvent,
  StudentProfile,
} from '@/src/types/models';

type RosterTab = 'registrations' | 'students';
type AwardOptionKey =
  | 'winner_first'
  | 'winner_second'
  | 'winner_third'
  | 'selected_squad'
  | 'participation';

const AWARD_OPTIONS: Record<
  AwardOptionKey,
  {
    label: string;
    certificateType: CertificateType;
    placement: CertificatePlacement;
    defaultTitle: string;
  }
> = {
  winner_first: {
    label: 'Winner — 1st Place',
    certificateType: 'winner',
    placement: 'winner',
    defaultTitle: 'Certificate of Excellence — Winner (1st Place)',
  },
  winner_second: {
    label: 'Runner-Up — 2nd Place',
    certificateType: 'winner',
    placement: 'runner_up',
    defaultTitle: 'Certificate of Merit — Runner-Up (2nd Place)',
  },
  winner_third: {
    label: 'Third Place — 3rd Position',
    certificateType: 'winner',
    placement: 'third_place',
    defaultTitle: 'Certificate of Merit — Third Place',
  },
  selected_squad: {
    label: 'Selected Student / Official Squad',
    certificateType: 'selected',
    placement: 'selected',
    defaultTitle: 'Certificate of Selection & Merit',
  },
  participation: {
    label: 'Participation Certificate',
    certificateType: 'participation',
    placement: 'participant',
    defaultTitle: 'Certificate of Participation',
  },
};

export function AdminCertificatesPage() {
  const { adminProfile } = useAuth();
  const { settings } = useSiteSettings();

  const [events, setEvents] = useState<SportEvent[]>([]);
  const [games, setGames] = useState<EventGame[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>([]);
  const [issuedList, setIssuedList] = useState<IssuedCertificate[]>([]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('all');
  const [rosterTab, setRosterTab] = useState<RosterTab>('registrations');
  const [searchTerm, setSearchTerm] = useState('');

  // Selection map keyed by unique item key (reg:<id> or stu:<uid>)
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});

  // Certificate Distribution Config
  const [awardKey, setAwardKey] = useState<AwardOptionKey>('winner_first');
  const [certificateTitle, setCertificateTitle] = useState(AWARD_OPTIONS.winner_first.defaultTitle);
  const [certificateNote, setCertificateNote] = useState('');
  const [useCustomImage, setUseCustomImage] = useState(false);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [alsoPublishResult, setAlsoPublishResult] = useState(true);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingCustom, setUploadingCustom] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [previewData, setPreviewData] = useState<CertificateData | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<IssuedCertificate | null>(null);

  const loadAll = useCallback(async () => {
    if (!adminProfile) return;
    setLoading(true);
    try {
      const [evList, regList, profileList, certList] = await Promise.all([
        listAllEventsForAdmin(adminProfile),
        listRegistrationsForAdmin(adminProfile),
        listAllStudentProfilesForAdmin(),
        listAllCertificatesForAdmin(adminProfile),
      ]);
      setEvents(evList);
      setRegistrations(regList);
      setStudentProfiles(profileList);
      setIssuedList(certList);

      if (evList.length > 0 && !selectedEventId) {
        setSelectedEventId(evList[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load certificate workspace.');
    } finally {
      setLoading(false);
    }
  }, [adminProfile, selectedEventId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedEventId) {
      setGames([]);
      return;
    }
    listAllGames(selectedEventId)
      .then((gmList) => setGames(gmList))
      .catch(() => setGames([]));
    setSelectedGameId('all');
    setSelectedKeys({});
  }, [selectedEventId]);

  const handleAwardChange = (nextKey: AwardOptionKey) => {
    setAwardKey(nextKey);
    setCertificateTitle(AWARD_OPTIONS[nextKey].defaultTitle);
  };

  const profileByRegNo = useMemo(() => {
    const map = new Map<string, StudentProfile>();
    for (const p of studentProfiles) {
      map.set(normalizeEnrollment(p.registrationNumber), p);
    }
    return map;
  }, [studentProfiles]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) || null,
    [events, selectedEventId]
  );

  const selectedGame = useMemo(
    () => games.find((g) => g.id === selectedGameId) || null,
    [games, selectedGameId]
  );

  const eventRegistrations = useMemo(() => {
    return registrations.filter((r) => {
      if (selectedEventId && r.eventId !== selectedEventId) return false;
      if (selectedGameId !== 'all' && r.gameId !== selectedGameId) return false;
      return !['rejected', 'withdrawn', 'cancelled'].includes(r.registrationStatus);
    });
  }, [registrations, selectedEventId, selectedGameId]);

  const filteredRegistrations = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return eventRegistrations;
    return eventRegistrations.filter(
      (r) =>
        r.participant.fullName.toLowerCase().includes(q) ||
        r.participant.enrollmentNumber.toLowerCase().includes(q) ||
        r.participant.branch.toLowerCase().includes(q) ||
        r.gameName.toLowerCase().includes(q)
    );
  }, [eventRegistrations, searchTerm]);

  const filteredStudentProfiles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return studentProfiles;
    return studentProfiles.filter(
      (p) =>
        p.fullName.toLowerCase().includes(q) ||
        p.registrationNumber.toLowerCase().includes(q) ||
        p.branch.toLowerCase().includes(q) ||
        p.year.toLowerCase().includes(q) ||
        (p.batch || '').toLowerCase().includes(q)
    );
  }, [studentProfiles, searchTerm]);

  const visibleRowKeys = useMemo(() => {
    if (rosterTab === 'registrations') {
      return filteredRegistrations.map((r) => `reg:${r.id}`);
    }
    return filteredStudentProfiles.map((p) => `stu:${p.uid}`);
  }, [rosterTab, filteredRegistrations, filteredStudentProfiles]);

  const selectedRecipients = useMemo((): CertificateRecipientInput[] => {
    const list: CertificateRecipientInput[] = [];
    for (const r of eventRegistrations) {
      if (selectedKeys[`reg:${r.id}`]) {
        list.push(buildRecipientFromRegistration(r, profileByRegNo));
      }
    }
    for (const p of studentProfiles) {
      if (selectedKeys[`stu:${p.uid}`]) {
        list.push(buildRecipientFromStudentProfile(p));
      }
    }
    return list;
  }, [eventRegistrations, studentProfiles, selectedKeys, profileByRegNo]);

  const handleToggleAllVisible = () => {
    const allSelected =
      visibleRowKeys.length > 0 && visibleRowKeys.every((k) => Boolean(selectedKeys[k]));
    setSelectedKeys((prev) => {
      const next = { ...prev };
      for (const k of visibleRowKeys) {
        next[k] = !allSelected;
      }
      return next;
    });
  };

  const handleCustomCertificateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setUploadingCustom(true);
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1150,
        maxChars: 350000,
      });
      setCustomImageUrl(compressed);
      setUseCustomImage(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process uploaded certificate image.');
    } finally {
      setUploadingCustom(false);
    }
  };

  const handleDistributeToSelected = async () => {
    if (!adminProfile || !selectedEvent) {
      setError('Select an event first.');
      return;
    }
    if (selectedRecipients.length === 0) {
      setError('Select at least one student or participant checkbox below.');
      return;
    }
    if (useCustomImage && !customImageUrl.trim()) {
      setError('Upload a certificate image or switch to Official Dynamic Certificate template.');
      return;
    }

    const award = AWARD_OPTIONS[awardKey];
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const count = await distributeCertificates(
        {
          eventId: selectedEvent.id,
          eventName: selectedEvent.name,
          gameId: selectedGame?.id || '',
          gameName: selectedGame?.name || selectedEvent.name,
          certificateType: award.certificateType,
          placement: award.placement,
          certificateTitle: certificateTitle.trim() || award.defaultTitle,
          certificateNote: certificateNote.trim(),
          customImageUrl: useCustomImage ? customImageUrl.trim() : '',
          recipients: selectedRecipients,
        },
        adminProfile
      );

      // Optionally also publish podium winners to Public Results Panel
      if (
        alsoPublishResult &&
        (award.placement === 'winner' ||
          award.placement === 'runner_up' ||
          award.placement === 'third_place')
      ) {
        const resultPlacement: ResultPlacement = award.placement;
        for (const rec of selectedRecipients) {
          await savePublishedResult(
            {
              eventId: selectedEvent.id,
              eventName: selectedEvent.name,
              gameId: selectedGame?.id || '',
              gameName: selectedGame?.name || selectedEvent.name,
              category: selectedGame?.category || 'Other',
              participationType: 'individual',
              winnerDisplayName: rec.teamName || rec.studentName,
              branch: rec.branch,
              year: rec.year,
              placement: resultPlacement,
              scoreOrRemark:
                certificateNote.trim() ||
                `${rec.studentName} (${rec.registrationNumber})`,
              registrationId: rec.registrationId,
              published: true,
            },
            adminProfile
          );
        }
      }

      setSelectedKeys({});
      setNotice(
        `Successfully distributed ${count} "${award.label}" certificate(s) to selected students.`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to distribute certificates.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkParticipationDistribute = async () => {
    if (!adminProfile || !selectedEvent) {
      setError('Select an event first.');
      return;
    }
    if (eventRegistrations.length === 0) {
      setError('No active registered students found for this event / game filter.');
      return;
    }
    if (useCustomImage && !customImageUrl.trim()) {
      setError('Upload a participation certificate image or switch to Official Dynamic Template.');
      return;
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const recipients = eventRegistrations.map((r) =>
        buildRecipientFromRegistration(r, profileByRegNo)
      );
      const count = await distributeCertificates(
        {
          eventId: selectedEvent.id,
          eventName: selectedEvent.name,
          gameId: selectedGame?.id || '',
          gameName: selectedGame?.name || selectedEvent.name,
          certificateType: 'participation',
          placement: 'participant',
          certificateTitle: certificateTitle.trim() || 'Certificate of Participation',
          certificateNote:
            certificateNote.trim() ||
            `Issued to all registered participants of ${
              selectedGame?.name || selectedEvent.name
            }`,
          customImageUrl: useCustomImage ? customImageUrl.trim() : '',
          recipients,
        },
        adminProfile
      );
      setNotice(
        `Distributed Participation Certificates to all ${count} registered student(s) in ${
          selectedGame?.name || selectedEvent.name
        }.`
      );
      await loadAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to distribute bulk participation certificates.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!adminProfile || !revokeTarget) return;
    try {
      await revokeIssuedCertificate(revokeTarget, adminProfile);
      setIssuedList((prev) => prev.filter((c) => c.id !== revokeTarget.id));
      setRevokeTarget(null);
      setNotice('Certificate revoked and removed from student access.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to revoke certificate.');
    }
  };

  const buildPreview = (cert: IssuedCertificate): CertificateData => ({
    certificateId: cert.id,
    certificateTitle: cert.certificateTitle,
    certificateNote: cert.certificateNote,
    participantName: cert.studentName,
    enrollmentNumber: cert.registrationNumber,
    branch: cert.branch,
    batch: cert.batch,
    year: cert.year,
    teamName: cert.teamName,
    eventName: cert.eventName,
    gameName: cert.gameName,
    registrationReference: cert.id,
    resultLabel: getStatusLabel(cert.placement),
    issuedAtText: formatDateTime(cert.issuedAt).split(',')[0] || formatDateTime(cert.issuedAt),
    customImageUrl: cert.customImageUrl,
    settings,
  });

  const filteredIssuedList = useMemo(() => {
    if (!selectedEventId) return issuedList;
    return issuedList.filter((c) => c.eventId === selectedEventId);
  }, [issuedList, selectedEventId]);

  return (
    <AdminLayout
      title="Winner & Certificate Distribution"
      breadcrumb="Admin / Certificates"
    >
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

        {/* Step 1: Target Event, Game & Certificate Artwork Configuration */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="font-display text-lg font-bold text-[#142D50]">
              1. Configure Certificate &amp; Target Event
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Select winners or multiple students below, upload one certificate image (or use the
              official dynamic template), and distribute to all selected students or every registered participant.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="cert-event" className="block text-xs font-semibold text-slate-800 mb-1">
                Select Event *
              </label>
              <select
                id="cert-event"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                {events.length === 0 && <option value="">No events found</option>}
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cert-game" className="block text-xs font-semibold text-slate-800 mb-1">
                Select Game
              </label>
              <select
                id="cert-game"
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                <option value="all">All Games / Overall Event</option>
                {games.map((gm) => (
                  <option key={gm.id} value={gm.id}>
                    {gm.name} ({gm.category})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cert-award" className="block text-xs font-semibold text-slate-800 mb-1">
                Certificate Type (Participation / Appreciation / Winner)
              </label>
              <select
                id="cert-award"
                value={awardKey}
                onChange={(e) => handleAwardChange(e.target.value as AwardOptionKey)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
              >
                {Object.entries(AWARD_OPTIONS).map(([k, val]) => (
                  <option key={k} value={k}>
                    {val.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cert-title" className="block text-xs font-semibold text-slate-800 mb-1">
                Certificate Heading
              </label>
              <input
                id="cert-title"
                type="text"
                value={certificateTitle}
                onChange={(e) => setCertificateTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label htmlFor="cert-note" className="block text-xs font-semibold text-slate-800 mb-1">
                Note / Score (Optional)
              </label>
              <input
                id="cert-note"
                type="text"
                value={certificateNote}
                onChange={(e) => setCertificateNote(e.target.value)}
                placeholder="e.g. Gold Medal · Appreciation for Outstanding Performance"
                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Template vs Custom Uploaded Certificate */}
          <div className="p-4 bg-[#F4F6F8] border border-slate-200 rounded-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#142D50] cursor-pointer">
                  <input
                    type="radio"
                    name="certMode"
                    checked={!useCustomImage}
                    onChange={() => setUseCustomImage(false)}
                  />
                  <span>Official Dynamic Template (Auto-prints Name, Reg No, Branch, Year)</span>
                </label>
                <label className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#142D50] cursor-pointer">
                  <input
                    type="radio"
                    name="certMode"
                    checked={useCustomImage}
                    onChange={() => setUseCustomImage(true)}
                  />
                  <span>Upload Certificate Image (Give to All Selected Students)</span>
                </label>
              </div>
            </div>

            {useCustomImage && (
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] cursor-pointer">
                    <ImagePlus className="w-4 h-4 text-[#F28C28]" />
                    <span>
                      {uploadingCustom ? 'Compressing Certificate...' : 'Choose Certificate File'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => void handleCustomCertificateUpload(e)}
                      className="hidden"
                    />
                  </label>
                  <input
                    type="url"
                    value={customImageUrl.startsWith('data:') ? '' : customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    placeholder="Or paste certificate image URL (https://...)"
                    className="flex-1 min-w-[240px] rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-xs"
                  />
                </div>
                {customImageUrl && (
                  <div className="flex items-center gap-4">
                    <img
                      src={customImageUrl}
                      alt="Uploaded certificate preview"
                      className="h-24 rounded-lg border border-slate-300 bg-white object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setCustomImageUrl('')}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove Image
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {(awardKey === 'winner_first' ||
            awardKey === 'winner_second' ||
            awardKey === 'winner_third') && (
            <label className="flex items-center gap-2 text-xs sm:text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={alsoPublishResult}
                onChange={(e) => setAlsoPublishResult(e.target.checked)}
              />
              <span>
                Also publish selected winner(s) automatically to the public Results Panel
              </span>
            </label>
          )}
        </div>

        {/* Step 2: Select Students / Winners / Registered Participants */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-6 border-b border-slate-200 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold text-[#142D50]">
                  2. Select Winner(s) or Students ({selectedRecipients.length} selected)
                </h2>
                <p className="text-xs text-slate-600">
                  Switch between Registered Participants and Logged-in Student Profiles (Name, Reg
                  No., Branch, Year).
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={submitting || selectedRecipients.length === 0 || !selectedEvent}
                  onClick={() => void handleDistributeToSelected()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5 text-[#F28C28]" />
                  <span>Give Certificate to Selected ({selectedRecipients.length})</span>
                </button>
                <button
                  type="button"
                  disabled={submitting || eventRegistrations.length === 0 || !selectedEvent}
                  onClick={() => void handleBulkParticipationDistribute()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#142D50] bg-[#F28C28] rounded-lg hover:bg-[#f79d42] disabled:opacity-50"
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>
                    Participation Cert for All Registered ({eventRegistrations.length})
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRosterTab('registrations')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    rosterTab === 'registrations'
                      ? 'bg-[#142D50] text-white'
                      : 'bg-[#F4F6F8] text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Registered Participants ({filteredRegistrations.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRosterTab('students')}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                    rosterTab === 'students'
                      ? 'bg-[#142D50] text-white'
                      : 'bg-[#F4F6F8] text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Logged-in Student Profiles ({filteredStudentProfiles.length})</span>
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, reg no, branch, year..."
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 pl-9 pr-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-sm text-slate-500">Loading student rosters...</div>
          ) : rosterTab === 'registrations' ? (
            filteredRegistrations.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No active registered participants match this Event / Game filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 w-10">
                        <button
                          type="button"
                          onClick={handleToggleAllVisible}
                          className="text-[#142D50]"
                          aria-label="Toggle select all visible registrations"
                        >
                          {visibleRowKeys.length > 0 &&
                          visibleRowKeys.every((k) => Boolean(selectedKeys[k])) ? (
                            <CheckSquare className="w-4 h-4" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-3 px-4">Participant</th>
                      <th className="py-3 px-4">Branch &amp; Year</th>
                      <th className="py-3 px-4">Game</th>
                      <th className="py-3 px-4">Status / Outcome</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredRegistrations.map((reg) => {
                      const key = `reg:${reg.id}`;
                      const checked = Boolean(selectedKeys[key]);
                      return (
                        <tr
                          key={reg.id}
                          onClick={() =>
                            setSelectedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
                          }
                          className={`cursor-pointer transition-colors ${
                            checked ? 'bg-amber-50/60' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => undefined}
                              aria-label={`Select ${reg.participant.fullName}`}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-[#142D50]">
                              {reg.participant.fullName}
                              {reg.team?.teamName ? ` (${reg.team.teamName})` : ''}
                            </p>
                            <p className="text-xs font-mono text-slate-500">
                              {reg.participant.enrollmentNumber}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {reg.participant.branch} · {reg.participant.year}
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-[#142D50]">
                            {reg.gameName}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusTag status={reg.registrationStatus} />
                              {reg.result !== 'no_result' && <StatusTag status={reg.result} />}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredStudentProfiles.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No logged-in student profiles found yet. When students log in with Google and save
              their Name, Registration Number, Phone, Branch, and Year, they appear here automatically.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4 w-10">
                      <button
                        type="button"
                        onClick={handleToggleAllVisible}
                        className="text-[#142D50]"
                        aria-label="Toggle select all visible student profiles"
                      >
                        {visibleRowKeys.length > 0 &&
                        visibleRowKeys.every((k) => Boolean(selectedKeys[k])) ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-4">Student Name &amp; Reg No.</th>
                    <th className="py-3 px-4">Branch</th>
                    <th className="py-3 px-4">Year</th>
                    <th className="py-3 px-4">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredStudentProfiles.map((prof) => {
                    const key = `stu:${prof.uid}`;
                    const checked = Boolean(selectedKeys[key]);
                    return (
                      <tr
                        key={prof.uid}
                        onClick={() =>
                          setSelectedKeys((prev) => ({ ...prev, [key]: !prev[key] }))
                        }
                        className={`cursor-pointer transition-colors ${
                          checked ? 'bg-amber-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => undefined}
                            aria-label={`Select ${prof.fullName}`}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#142D50]">{prof.fullName}</p>
                          <p className="text-xs font-mono text-slate-500">
                            {prof.registrationNumber}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700">{prof.branch}</td>
                        <td className="py-3 px-4 text-xs text-slate-700">{prof.year}</td>
                        <td className="py-3 px-4 text-xs font-mono text-slate-700">{prof.phone}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Step 3: Issued Certificates Ledger */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#142D50]">
              Distributed Certificates Ledger ({filteredIssuedList.length})
            </h2>
          </div>

          {filteredIssuedList.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              No certificates distributed for this event yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="py-3 px-4">Certificate ID</th>
                    <th className="py-3 px-4">Student &amp; Reg No.</th>
                    <th className="py-3 px-4">Academic Details</th>
                    <th className="py-3 px-4">Award / Game</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredIssuedList.map((cert) => {
                    const data = buildPreview(cert);
                    return (
                      <tr key={cert.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-[#142D50]">
                          {cert.id}
                          {cert.customImageUrl && (
                            <span className="block text-[10px] font-sans text-emerald-700">
                              Custom Upload
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-[#142D50]">{cert.studentName}</p>
                          <p className="text-xs font-mono text-slate-500">
                            {cert.registrationNumber}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {cert.branch} · {cert.year}
                          {cert.batch ? ` (Batch ${cert.batch})` : ''}
                        </td>
                        <td className="py-3 px-4">
                          <StatusTag status={cert.placement} />
                          <p className="mt-1 text-xs text-slate-600">{cert.gameName}</p>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPreviewData(data)}
                              className="p-1.5 rounded-lg border border-slate-300 text-[#142D50] hover:bg-slate-100"
                              title="Preview Certificate"
                            >
                              <ShieldCheck className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadCertificatePng(data)}
                              className="p-1.5 rounded-lg border border-slate-300 text-[#142D50] hover:bg-slate-100"
                              title="Download Certificate"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRevokeTarget(cert)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50"
                              title="Revoke Certificate"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <CertificateModal
        open={Boolean(previewData)}
        data={previewData}
        onClose={() => setPreviewData(null)}
      />

      <ConfirmModal
        open={Boolean(revokeTarget)}
        title="Revoke Issued Certificate?"
        description={`Revoking ${revokeTarget?.id} will remove this certificate from ${revokeTarget?.studentName}'s Student Account.`}
        confirmLabel="Revoke Certificate"
        confirmTone="danger"
        onCancel={() => setRevokeTarget(null)}
        onConfirm={handleRevokeConfirm}
      />
    </AdminLayout>
  );
}

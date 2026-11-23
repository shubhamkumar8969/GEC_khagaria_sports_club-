import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Award,
  Ban,
  Calendar,
  CheckCircle2,
  Download,
  Edit3,
  Gamepad2,
  LogIn,
  LogOut,
  Printer,
  ShieldCheck,
  Trophy,
  UserCheck,
} from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { StatusTag, getStatusLabel } from '@/src/components/common/StatusBadge';
import { CertificateModal } from '@/src/components/common/CertificateModal';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listPublicEvents } from '@/src/services/firebase/events';
import {
  listRegistrationsForStudentUid,
  lookupStudentPortalEntries,
} from '@/src/services/firebase/registrations';
import { listCertificatesForStudent } from '@/src/services/firebase/certificates';
import { logStudentActivity, saveStudentProfile } from '@/src/services/firebase/students';
import { SEMESTER_OPTIONS, studentProfileSchema } from '@/src/schemas/validation';
import { formatDateTime } from '@/src/utils/formatters';
import { downloadCertificatePng, type CertificateData } from '@/src/utils/certificateGenerator';
import type { Timestamp } from 'firebase/firestore';
import type {
  IssuedCertificate,
  Registration,
  SportEvent,
  StudentPortalEntry,
} from '@/src/types/models';

interface UnifiedDashboardCard {
  id: string;
  registrationReference: string;
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  participantName: string;
  enrollmentNumber: string;
  branch: string;
  year: string;
  teamName: string;
  participationType: string;
  teamAssignment: string;
  matchStatus: string;
  result: string;
  certificateIssued: boolean;
  certificateId: string;
  certificateTitle: string;
  certificateNote: string;
  certificateIssuedAtText: string;
  updatedAt?: Timestamp | null;
}

function mapPortalEntryToCard(item: StudentPortalEntry): UnifiedDashboardCard {
  return {
    id: item.registrationId,
    registrationReference: item.registrationReference,
    eventId: item.eventId,
    eventName: item.eventName,
    gameId: item.gameId,
    gameName: item.gameName,
    participantName: item.participantName,
    enrollmentNumber: item.enrollmentNumber,
    branch: item.branch,
    year: item.year,
    teamName: item.teamName,
    participationType: item.participationType,
    teamAssignment: item.teamAssignment,
    matchStatus: item.matchStatus,
    result: item.result,
    certificateIssued: Boolean(item.certificateIssued),
    certificateId: item.certificateId || '',
    certificateTitle: item.certificateTitle || 'Certificate of Participation',
    certificateNote: item.certificateNote || '',
    certificateIssuedAtText: item.certificateIssuedAt
      ? formatDateTime(item.certificateIssuedAt)
      : formatDateTime(item.updatedAt),
    updatedAt: item.updatedAt,
  };
}

function mapRegToCard(item: Registration): UnifiedDashboardCard {
  return {
    id: item.id,
    registrationReference: item.registrationReference,
    eventId: item.eventId,
    eventName: item.eventName,
    gameId: item.gameId,
    gameName: item.gameName,
    participantName: item.participant.fullName,
    enrollmentNumber: item.participant.enrollmentNumber,
    branch: item.participant.branch,
    year: item.participant.year,
    teamName: item.team?.teamName || '',
    participationType: item.participationType,
    teamAssignment: item.teamAssignment,
    matchStatus: item.matchStatus,
    result: item.result,
    certificateIssued: Boolean(item.certificateIssued),
    certificateId: item.certificateId || '',
    certificateTitle: item.certificateTitle || 'Certificate of Participation',
    certificateNote: item.certificateNote || '',
    certificateIssuedAtText: item.certificateIssuedAt
      ? formatDateTime(item.certificateIssuedAt)
      : formatDateTime(item.updatedAt),
    updatedAt: item.updatedAt,
  };
}

export function StudentPortalPage() {
  const { settings } = useSiteSettings();
  const {
    firebaseUser,
    studentProfile,
    studentAccount,
    isStudentBlocked,
    loading: authLoading,
    authError,
    loginStudentWithGoogle,
    setStudentProfileState,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const profileEditParam = searchParams.get('profile') === 'edit';
  const rawRedirect = searchParams.get('redirect') || '';
  const safeRedirect =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '';

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const [eventsMap, setEventsMap] = useState<Record<string, SportEvent>>({});

  const [editingProfile, setEditingProfile] = useState(false);
  const [pName, setPName] = useState('');
  const [pRegNo, setPRegNo] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pBranch, setPBranch] = useState(settings.branches[0] || 'CSE (IoT)');
  const [pYear, setPYear] = useState(settings.years[0] || '1st Year');
  const [pSemester, setPSemester] = useState<string>(SEMESTER_OPTIONS[0]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  const [signingIn, setSigningIn] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<UnifiedDashboardCard[]>([]);
  const [issuedCertificates, setIssuedCertificates] = useState<IssuedCertificate[]>([]);
  const [activeCertificate, setActiveCertificate] = useState<CertificateData | null>(null);

  useEffect(() => {
    if (studentProfile) {
      setPName(studentProfile.fullName);
      setPRegNo(studentProfile.registrationNumber);
      setPPhone(studentProfile.phone || '');
      setPBranch(studentProfile.branch || settings.branches[0] || 'CSE (IoT)');
      setPYear(studentProfile.year || settings.years[0] || '1st Year');
      setPSemester(studentProfile.semester || SEMESTER_OPTIONS[0]);
      setEditingProfile(profileEditParam);
    } else if (firebaseUser) {
      setPName((prev) => prev || firebaseUser.displayName || '');
      setEditingProfile(true);
    }
  }, [studentProfile, firebaseUser, profileEditParam, settings.branches, settings.years]);

  useEffect(() => {
    let active = true;
    listPublicEvents()
      .then((evList) => {
        if (!active) return;
        const map: Record<string, SportEvent> = {};
        for (const ev of evList) map[ev.id] = ev;
        setEventsMap(map);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const loadDashboardData = useCallback(
    async (uid: string, regNumber?: string, phone?: string) => {
      setLoadingData(true);
      setError(null);
      try {
        const [uidRegs, certs, portalList] = await Promise.all([
          listRegistrationsForStudentUid(uid),
          listCertificatesForStudent(uid, regNumber),
          regNumber && phone && phone.replace(/\D/g, '').length >= 7
            ? lookupStudentPortalEntries(regNumber, phone).catch(() => [])
            : Promise.resolve([]),
        ]);

        const mergedMap = new Map<string, UnifiedDashboardCard>();
        for (const r of uidRegs) {
          mergedMap.set(r.id, mapRegToCard(r));
        }
        for (const p of portalList) {
          if (!mergedMap.has(p.registrationId)) {
            mergedMap.set(p.registrationId, mapPortalEntryToCard(p));
          }
        }

        const merged = Array.from(mergedMap.values()).sort(
          (a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0)
        );
        setEntries(merged);
        setIssuedCertificates(certs);
        setLoaded(true);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load your participating events and certificates.'
        );
      } finally {
        setLoadingData(false);
      }
    },
    []
  );

  useEffect(() => {
    if (firebaseUser) {
      void loadDashboardData(
        firebaseUser.uid,
        studentProfile?.registrationNumber,
        studentProfile?.phone
      );
    } else {
      setEntries([]);
      setIssuedCertificates([]);
      setLoaded(false);
    }
  }, [
    firebaseUser,
    studentProfile?.registrationNumber,
    studentProfile?.phone,
    loadDashboardData,
  ]);

  const handleSaveStudentProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.email) return;
    setError(null);
    setProfileNotice(null);

    if (pPhone.trim().replace(/\D/g, '').length < 10) {
      setError('Please enter your 10-digit mobile number.');
      return;
    }

    const parsed = studentProfileSchema.safeParse({
      fullName: pName,
      registrationNumber: pRegNo,
      branch: pBranch,
      batch: '',
      year: pYear,
      semester: pSemester,
      phone: pPhone,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Check your student profile fields.');
      return;
    }

    setSavingProfile(true);
    try {
      const saved = await saveStudentProfile(firebaseUser.uid, firebaseUser.email, {
        fullName: parsed.data.fullName,
        registrationNumber: parsed.data.registrationNumber,
        branch: parsed.data.branch,
        batch: '',
        year: parsed.data.year,
        semester: parsed.data.semester,
        phone: parsed.data.phone,
      });
      setStudentProfileState(saved);
      setEditingProfile(false);
      if (profileEditParam) {
        const next = new URLSearchParams(searchParams);
        next.delete('profile');
        next.delete('redirect');
        setSearchParams(next, { replace: true });
      }
      setProfileNotice(
        'My Profile updated! Future event registrations will auto-fill with these details.'
      );
      void logStudentActivity({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        studentName: saved.fullName,
        registrationNumber: saved.registrationNumber,
        action: 'profile_saved',
        summary: `Updated student profile (${saved.registrationNumber}, ${saved.branch}, ${saved.year}${saved.semester ? `, ${saved.semester}` : ''})`,
        path: '/student',
        metadata: { branch: saved.branch, year: saved.year, semester: saved.semester || '' },
      });
      if (safeRedirect) {
        navigate(safeRedirect, { replace: true });
        return;
      }
      await loadDashboardData(firebaseUser.uid, saved.registrationNumber, saved.phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save student profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      const res = await loginStudentWithGoogle();
      if (res) {
        await loadDashboardData(
          res.user.uid,
          res.profile?.registrationNumber,
          res.profile?.phone
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const buildCertDataFromCard = (card: UnifiedDashboardCard): CertificateData => ({
    certificateId: card.certificateId || card.registrationReference,
    certificateTitle: card.certificateTitle || 'CERTIFICATE OF PARTICIPATION',
    certificateNote: card.certificateNote,
    participantName: card.participantName,
    enrollmentNumber: card.enrollmentNumber,
    branch: card.branch,
    year: card.year,
    teamName: card.teamName,
    eventName: card.eventName,
    gameName: card.gameName,
    registrationReference: card.registrationReference,
    resultLabel: getStatusLabel(card.result),
    issuedAtText: card.certificateIssuedAtText.split(',')[0] || card.certificateIssuedAtText,
    settings,
  });

  const buildCertDataFromIssued = (cert: IssuedCertificate): CertificateData => ({
    certificateId: cert.id,
    certificateTitle: cert.certificateTitle,
    certificateNote: cert.certificateNote,
    participantName: cert.studentName,
    enrollmentNumber: cert.registrationNumber,
    branch: cert.branch,
    year: cert.year,
    teamName: cert.teamName,
    eventName: cert.eventName,
    gameName: cert.gameName,
    registrationReference: cert.id,
    resultLabel: getStatusLabel(cert.placement),
    issuedAtText: formatDateTime(cert.issuedAt).split(',')[0] || formatDateTime(cert.issuedAt),
    customImageUrl: cert.customImageUrl || '',
    settings,
  });

  const summary = useMemo(() => {
    const distinctEvents = new Set(entries.map((e) => e.eventId)).size;
    const regCertIds = new Set(entries.filter((e) => e.certificateIssued).map((e) => e.certificateId));
    for (const c of issuedCertificates) regCertIds.add(c.id);
    return {
      totalGames: entries.length,
      distinctEvents,
      certCount: regCertIds.size,
    };
  }, [entries, issuedCertificates]);

  const darkInputClass =
    'w-full rounded-lg bg-[#080B14] border border-blue-500/35 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-red-400 focus:outline-none';

  return (
    <PublicLayout>
      <section className="bg-subpage-arena text-white py-12 border-b border-blue-500/20 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
              {settings.clubName}
            </p>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold">
              Student Dashboard &amp; Certificates
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-2xl">
              View all events and games you are participating in, manage your student profile, and
              download participation or appreciation certificates issued by the Sports Club.
            </p>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-lg btn-3d-red whitespace-nowrap shrink-0"
          >
            <Gamepad2 className="w-4 h-4" />
            <span>Register for Events</span>
          </Link>
        </div>
      </section>

      <section className="bg-campus-tint min-h-[65vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          {authLoading ? (
            <div className="h-56 card-3d rounded-2xl animate-pulse" />
          ) : !firebaseUser ? (
            <div className="card-3d rounded-2xl p-8 sm:p-10 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#1D4ED8] flex items-center justify-center text-white mx-auto shadow-lg">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="max-w-lg mx-auto space-y-2">
                <h2 className="font-display text-2xl font-bold text-white">
                  Sign In with Google to View Your Participation &amp; Certificates
                </h2>
                <p className="text-sm text-slate-300">
                  Log in with your Google account and save your Name, Registration Number, Phone
                  Number, Branch, and Year to register for sports events and download certificates.
                </p>
              </div>
              {(error || authError) && (
                <div className="max-w-md mx-auto bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-3 text-sm break-words overflow-hidden">
                  {error || authError}
                </div>
              )}
              <button
                type="button"
                disabled={signingIn}
                onClick={() => void handleGoogleSignIn()}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold rounded-xl btn-3d-mix disabled:opacity-60"
              >
                <ShieldCheck className="w-4 h-4 text-white" />
                <span>{signingIn ? 'Signing in...' : 'Continue with Google'}</span>
              </button>
            </div>
          ) : isStudentBlocked ? (
            <div className="card-3d rounded-2xl p-8 sm:p-10 text-center space-y-5 border border-red-500/40">
              <div className="w-14 h-14 rounded-2xl bg-red-950 border border-red-500/50 flex items-center justify-center text-red-400 mx-auto">
                <Ban className="w-7 h-7" />
              </div>
              <div className="max-w-lg mx-auto space-y-2">
                <h2 className="font-display text-2xl font-bold text-white">
                  Account Blocked by Administrator
                </h2>
                <p className="text-sm text-red-200">
                  {studentAccount?.blockedReason ||
                    'Your student account has been restricted by the Sports Club Administrator.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-700 rounded-xl hover:bg-red-600"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <>
              {/* Student Profile Card */}
              <div className="card-3d rounded-2xl p-6 sm:p-8 space-y-5 no-print">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#080B14] border border-blue-500/35 flex items-center justify-center text-white shrink-0">
                      <UserCheck className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                      <h2 className="font-display text-base font-bold text-white">
                        {studentProfile?.fullName || firebaseUser.displayName || firebaseUser.email}
                      </h2>
                      {studentProfile ? (
                        <div className="text-xs text-slate-300 mt-0.5 space-y-0.5">
                          <p>
                            Enrollment:{' '}
                            <span className="font-mono font-semibold text-blue-300">
                              {studentProfile.registrationNumber}
                            </span>{' '}
                            · {studentProfile.branch} · {studentProfile.year}
                            {studentProfile.semester ? ` · ${studentProfile.semester}` : ''}
                          </p>
                          <p className="text-slate-400">
                            {studentProfile.email || firebaseUser.email}
                            {studentProfile.phone ? ` · ${studentProfile.phone}` : ''}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-red-300 mt-0.5 font-medium">
                          One-Time Profile Setup: save your Name, Enrollment Number, Branch, Year,
                          Semester &amp; Mobile Number below.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {studentProfile && !editingProfile && (
                      <button
                        type="button"
                        onClick={() => setEditingProfile(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#080B14] border border-blue-500/35 rounded-lg hover:border-red-400"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-300" />
                        <span>My Profile / Edit Profile</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-[#080B14] border border-white/15 rounded-lg hover:border-red-400"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>

                {profileNotice && (
                  <div className="bg-blue-950/70 border border-blue-400/50 text-blue-100 rounded-lg p-3 text-xs">
                    {profileNotice}
                  </div>
                )}

                {error && (
                  <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-lg p-3 text-xs break-words overflow-hidden">
                    {error}
                  </div>
                )}

                {editingProfile && (
                  <form
                    onSubmit={(e) => void handleSaveStudentProfile(e)}
                    className="p-5 bg-[#080B14]/85 border border-blue-500/30 rounded-xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white">
                        {studentProfile ? 'My Profile / Edit Profile' : 'One-Time Student Profile'}
                      </h3>
                      {studentProfile && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProfile(false);
                            if (profileEditParam) {
                              const next = new URLSearchParams(searchParams);
                              next.delete('profile');
                              setSearchParams(next, { replace: true });
                            }
                          }}
                          className="text-xs text-blue-300 hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-blue-200 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={pName}
                          onChange={(e) => setPName(e.target.value)}
                          className={darkInputClass}
                          placeholder="Full Name"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-200 mb-1">
                          Enrollment Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={pRegNo}
                          onChange={(e) => setPRegNo(e.target.value)}
                          className={`${darkInputClass} font-mono uppercase`}
                          placeholder="e.g. 23105123001"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-200 mb-1">
                          Branch *
                        </label>
                        <select
                          value={pBranch}
                          onChange={(e) => setPBranch(e.target.value)}
                          className={darkInputClass}
                        >
                          {!settings.branches.includes(pBranch) && pBranch && (
                            <option value={pBranch} className="bg-[#0B101D] text-white">
                              {pBranch}
                            </option>
                          )}
                          {settings.branches.map((b) => (
                            <option key={b} value={b} className="bg-[#0B101D] text-white">
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-200 mb-1">
                          Year *
                        </label>
                        <select
                          value={pYear}
                          onChange={(e) => setPYear(e.target.value)}
                          className={darkInputClass}
                        >
                          {!settings.years.includes(pYear) && pYear && (
                            <option value={pYear} className="bg-[#0B101D] text-white">
                              {pYear}
                            </option>
                          )}
                          {settings.years.map((y) => (
                            <option key={y} value={y} className="bg-[#0B101D] text-white">
                              {y}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-200 mb-1">
                          Semester *
                        </label>
                        <select
                          value={pSemester}
                          onChange={(e) => setPSemester(e.target.value)}
                          className={darkInputClass}
                        >
                          {!SEMESTER_OPTIONS.includes(
                            pSemester as (typeof SEMESTER_OPTIONS)[number]
                          ) &&
                            pSemester && (
                              <option value={pSemester} className="bg-[#0B101D] text-white">
                                {pSemester}
                              </option>
                            )}
                          {SEMESTER_OPTIONS.map((sem) => (
                            <option key={sem} value={sem} className="bg-[#0B101D] text-white">
                              {sem}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-200 mb-1">
                          Mobile Number *
                        </label>
                        <input
                          type="tel"
                          required
                          value={pPhone}
                          onChange={(e) => setPPhone(e.target.value)}
                          className={`${darkInputClass} font-mono`}
                          placeholder="10-digit mobile number"
                        />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-medium text-blue-200 mb-1">
                          Verified Google Email
                        </label>
                        <input
                          type="email"
                          readOnly
                          disabled
                          value={firebaseUser.email || ''}
                          className={`${darkInputClass} opacity-80 cursor-not-allowed`}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-5 py-2 text-xs font-semibold rounded-lg btn-3d-blue disabled:opacity-60"
                      >
                        {savingProfile ? 'Saving...' : 'Save My Profile'}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Participation Summary Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card-3d-red rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-red-200/80">Events Participating</p>
                    <p className="mt-1 font-display text-3xl font-bold text-white tabular-nums">
                      {loadingData ? '—' : summary.distinctEvents}
                    </p>
                  </div>
                  <Trophy className="w-7 h-7 text-red-400/80" />
                </div>
                <div className="card-3d-blue rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-blue-200/80">Games Participating</p>
                    <p className="mt-1 font-display text-3xl font-bold text-white tabular-nums">
                      {loadingData ? '—' : summary.totalGames}
                    </p>
                  </div>
                  <Gamepad2 className="w-7 h-7 text-blue-400/80" />
                </div>
                <div className="card-3d-red rounded-2xl p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-red-200/80">Certificates Ready</p>
                    <p className="mt-1 font-display text-3xl font-bold text-white tabular-nums">
                      {loadingData ? '—' : summary.certCount}
                    </p>
                  </div>
                  <Award className="w-7 h-7 text-red-400/80" />
                </div>
              </div>

              {/* Official Issued Certificates */}
              {issuedCertificates.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white">
                      My Certificates ({issuedCertificates.length})
                    </h2>
                    <p className="text-sm text-slate-300">
                      Participation, Appreciation, and Winner certificates issued for your Registration Number.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {issuedCertificates.map((cert, idx) => {
                      const certData = buildCertDataFromIssued(cert);
                      return (
                        <article
                          key={cert.id}
                          className={`${
                            idx % 2 === 0 ? 'card-3d-red' : 'card-3d-blue'
                          } card-3d-hover rounded-2xl p-5 flex flex-col justify-between gap-4`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-xs font-semibold text-blue-300">
                                {cert.id}
                              </span>
                              <StatusTag status={cert.placement} />
                            </div>
                            <h3 className="font-display text-lg font-bold text-white">
                              {cert.certificateTitle}
                            </h3>
                            <p className="text-sm font-medium text-slate-200">
                              {cert.eventName}
                              {cert.gameName && cert.gameName !== cert.eventName
                                ? ` — ${cert.gameName}`
                                : ''}
                            </p>
                            <p className="text-xs text-slate-300">
                              {cert.studentName} · Reg No:{' '}
                              <span className="font-mono text-white">{cert.registrationNumber}</span>{' '}
                              · {cert.branch} ({cert.year})
                            </p>
                            {cert.certificateNote && (
                              <p className="text-xs text-slate-300 bg-[#080B14] p-2.5 rounded-lg border border-white/10">
                                {cert.certificateNote}
                              </p>
                            )}
                          </div>

                          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 no-print">
                            <span className="text-[11px] text-slate-400 tabular-nums">
                              Issued {formatDateTime(cert.issuedAt)}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCertificate(certData);
                                  if (firebaseUser?.email) {
                                    void logStudentActivity({
                                      uid: firebaseUser.uid,
                                      email: firebaseUser.email,
                                      studentName: cert.studentName,
                                      registrationNumber: cert.registrationNumber,
                                      action: 'certificate_preview',
                                      summary: `Previewed certificate ${cert.id} (${cert.eventName})`,
                                      path: '/student',
                                      eventId: cert.eventId,
                                      gameId: cert.gameId,
                                      metadata: { certificateId: cert.id },
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#080B14] border border-blue-500/35 rounded-lg hover:border-red-400"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                                <span>Preview</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  downloadCertificatePng(certData);
                                  if (firebaseUser?.email) {
                                    void logStudentActivity({
                                      uid: firebaseUser.uid,
                                      email: firebaseUser.email,
                                      studentName: cert.studentName,
                                      registrationNumber: cert.registrationNumber,
                                      action: 'certificate_download',
                                      summary: `Downloaded certificate ${cert.id} (${cert.eventName})`,
                                      path: '/student',
                                      eventId: cert.eventId,
                                      gameId: cert.gameId,
                                      metadata: { certificateId: cert.id },
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg btn-3d-blue"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Certificate</span>
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty Participation State */}
              {loaded && entries.length === 0 && issuedCertificates.length === 0 && (
                <div className="card-3d rounded-2xl p-8 text-center space-y-4">
                  <h2 className="font-display text-lg font-bold text-white">
                    No Participating Events or Certificates Yet
                  </h2>
                  <p className="text-sm text-slate-300 max-w-lg mx-auto">
                    Browse live campus events and register for games to see your participation
                    list and download certificates here.
                  </p>
                  <Link
                    to="/events"
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg btn-3d-red"
                  >
                    <span>Browse Open Events</span>
                  </Link>
                </div>
              )}

              {/* Participating Events & Games List */}
              {entries.length > 0 && (
                <div className="space-y-5">
                  <h2 className="font-display text-xl font-bold text-white">
                    Participating Events &amp; Games ({entries.length})
                  </h2>
                  {entries.map((entry, idx) => {
                    const liveEvent = eventsMap[entry.eventId];
                    return (
                      <article
                        key={`${entry.id}-${entry.registrationReference}`}
                        className={`${
                          idx % 2 === 0 ? 'card-3d-blue' : 'card-3d-red'
                        } rounded-2xl p-6 space-y-4`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-white/10">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="font-mono font-semibold text-blue-300">
                                {entry.registrationReference}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize">{entry.participationType} Entry</span>
                              {entry.teamName && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="text-slate-200 font-medium">
                                    Team: {entry.teamName}
                                  </span>
                                </>
                              )}
                              {liveEvent && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-red-400" />
                                    <strong className="text-white">
                                      {getStatusLabel(liveEvent.status)}
                                    </strong>
                                  </span>
                                </>
                              )}
                            </div>
                            <h3 className="mt-1 font-display text-xl sm:text-2xl font-bold text-white">
                              {entry.eventName} — {entry.gameName}
                            </h3>
                            <p className="mt-1 text-xs sm:text-sm text-slate-300">
                              {entry.participantName} · {entry.enrollmentNumber} · {entry.branch} (
                              {entry.year})
                            </p>
                          </div>

                          <div className="flex items-center gap-2 no-print">
                            <Link
                              to={`/events/${entry.eventId}/games/${entry.gameId}`}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-[#080B14] border border-blue-500/35 rounded-lg hover:border-red-400"
                            >
                              Game Info
                            </Link>
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#080B14] border border-white/15 rounded-lg hover:border-blue-400"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Print</span>
                            </button>
                          </div>
                        </div>

                        {/* Certificate Issuance Strip */}
                        <div
                          className={`rounded-xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                            entry.certificateIssued
                              ? 'bg-blue-950/60 border-blue-400/50'
                              : 'bg-[#080B14]/80 border-white/10'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                entry.certificateIssued
                                  ? 'bg-red-600/30 text-red-300 border border-red-400/40'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {entry.certificateIssued ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <Award className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">
                                {entry.certificateIssued
                                  ? `${entry.certificateTitle} — Available`
                                  : 'Participation Confirmed · Certificate Pending'}
                              </p>
                              <p className="text-xs text-slate-300 mt-0.5">
                                {entry.certificateIssued
                                  ? `Certificate ID: ${entry.certificateId} · Ready to preview or download.`
                                  : 'Your participation/appreciation certificate will appear here when issued by the Sports Club Admin.'}
                              </p>
                            </div>
                          </div>

                          {entry.certificateIssued && (
                            <div className="flex flex-wrap items-center gap-2 no-print shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveCertificate(buildCertDataFromCard(entry));
                                  if (firebaseUser?.email) {
                                    void logStudentActivity({
                                      uid: firebaseUser.uid,
                                      email: firebaseUser.email,
                                      studentName: entry.participantName,
                                      registrationNumber: entry.enrollmentNumber,
                                      action: 'certificate_preview',
                                      summary: `Previewed certificate ${entry.certificateId || entry.registrationReference} (${entry.eventName} — ${entry.gameName})`,
                                      path: '/student',
                                      eventId: entry.eventId,
                                      gameId: entry.gameId,
                                      metadata: { certificateId: entry.certificateId },
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-[#080B14] border border-blue-500/35 rounded-lg hover:border-red-400"
                              >
                                <ShieldCheck className="w-3.5 h-3.5 text-red-400" />
                                <span>Preview</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  downloadCertificatePng(buildCertDataFromCard(entry));
                                  if (firebaseUser?.email) {
                                    void logStudentActivity({
                                      uid: firebaseUser.uid,
                                      email: firebaseUser.email,
                                      studentName: entry.participantName,
                                      registrationNumber: entry.enrollmentNumber,
                                      action: 'certificate_download',
                                      summary: `Downloaded certificate ${entry.certificateId || entry.registrationReference} (${entry.eventName} — ${entry.gameName})`,
                                      path: '/student',
                                      eventId: entry.eventId,
                                      gameId: entry.gameId,
                                      metadata: { certificateId: entry.certificateId },
                                    });
                                  }
                                }}
                                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg btn-3d-red"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Certificate</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <CertificateModal
        open={Boolean(activeCertificate)}
        data={activeCertificate}
        onClose={() => setActiveCertificate(null)}
      />
    </PublicLayout>
  );
}

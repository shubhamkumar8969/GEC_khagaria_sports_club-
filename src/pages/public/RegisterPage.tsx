import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Ban, CheckCircle2, Edit3, LogIn, LogOut, Plus, Printer, ShieldCheck, Trash2, UserCheck } from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { getEventById, getGameById, getGameCounterCount } from '@/src/services/firebase/events';
import {
  submitRegistration,
  type SubmitRegistrationResult,
} from '@/src/services/firebase/registrations';
import { logStudentActivity, saveStudentProfile } from '@/src/services/firebase/students';
import {
  SEMESTER_OPTIONS,
  participantSchema,
  studentProfileSchema,
  validateCustomAnswers,
} from '@/src/schemas/validation';
import { formatDateTime } from '@/src/utils/formatters';
import type { EventGame, ParticipantInfo, SportEvent, TeamMember } from '@/src/types/models';

export function RegisterPage() {
  const { eventId, gameId } = useParams<{ eventId: string; gameId: string }>();
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
  const { settings } = useSiteSettings();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const [event, setEvent] = useState<SportEvent | null>(null);
  const [game, setGame] = useState<EventGame | null>(null);
  const [entryCount, setEntryCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [participant, setParticipant] = useState<ParticipantInfo>({
    fullName: '',
    enrollmentNumber: '',
    branch: settings.branches[0] || 'CSE (IoT)',
    batch: '',
    year: settings.years[0] || '1st Year',
    semester: '',
    phone: '',
    email: '',
  });

  const lastSyncedProfileKeyRef = useRef<string>('');

  // Inline One-Time Profile Completion state (shown if signed in without a saved profile)
  const [setupName, setSetupName] = useState('');
  const [setupRegNo, setSetupRegNo] = useState('');
  const [setupBranch, setSetupBranch] = useState(settings.branches[0] || 'CSE (IoT)');
  const [setupYear, setSetupYear] = useState(settings.years[0] || '1st Year');
  const [setupSemester, setSetupSemester] = useState<string>(SEMESTER_OPTIONS[0]);
  const [setupPhone, setSetupPhone] = useState('');
  const [savingSetup, setSavingSetup] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseUser && !studentProfile) {
      setSetupName((prev) => prev || firebaseUser.displayName || '');
    }
  }, [firebaseUser, studentProfile]);

  useEffect(() => {
    if (!studentProfile) {
      lastSyncedProfileKeyRef.current = '';
      if (firebaseUser) {
        setParticipant((prev) => ({
          ...prev,
          fullName: prev.fullName || firebaseUser.displayName || '',
          email: prev.email || firebaseUser.email || '',
        }));
      }
      return;
    }

    const profileVersionKey = `${studentProfile.uid}:${studentProfile.updatedAt?.toMillis?.() ?? studentProfile.registrationNumber}:${studentProfile.fullName}:${studentProfile.branch}:${studentProfile.year}:${studentProfile.semester || ''}:${studentProfile.phone}`;
    if (lastSyncedProfileKeyRef.current === profileVersionKey) return;
    lastSyncedProfileKeyRef.current = profileVersionKey;

    setParticipant({
      fullName: studentProfile.fullName || firebaseUser?.displayName || '',
      enrollmentNumber: studentProfile.registrationNumber || '',
      branch: studentProfile.branch || settings.branches[0] || 'CSE (IoT)',
      batch: studentProfile.batch || '',
      year: studentProfile.year || settings.years[0] || '1st Year',
      semester: studentProfile.semester || '',
      phone: studentProfile.phone || '',
      email: studentProfile.email || firebaseUser?.email || '',
    });
  }, [studentProfile, firebaseUser, settings.branches, settings.years]);

  const [teamName, setTeamName] = useState('');
  const [additionalMembers, setAdditionalMembers] = useState<TeamMember[]>([]);
  const [customAnswers, setCustomAnswers] = useState<
    Record<string, string | number | boolean | string[]>
  >({});
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<SubmitRegistrationResult | null>(null);

  useEffect(() => {
    if (!eventId || !gameId) return;
    let active = true;
    async function load() {
      try {
        const [evt, gm, count] = await Promise.all([
          getEventById(eventId!),
          getGameById(eventId!, gameId!),
          getGameCounterCount(eventId!, gameId!),
        ]);
        if (!active) return;
        setEvent(evt);
        setGame(gm);
        setEntryCount(count);

        if (gm) {
          const initialAnswers: Record<string, string | number | boolean | string[]> = {};
          for (const f of gm.customFields) {
            initialAnswers[f.id] = f.type === 'checkboxes' ? [] : '';
          }
          setCustomAnswers(initialAnswers);

          const initialSlots =
            gm.participationType === 'doubles'
              ? 1
              : gm.participationType === 'team'
              ? Math.max(1, Math.min(gm.maxTeamSize - 1, gm.minTeamSize - 1))
              : 0;
          setAdditionalMembers(
            Array.from({ length: initialSlots }, () => ({
              fullName: '',
              enrollmentNumber: '',
              branch: '',
              year: '',
              roleLabel: '',
            }))
          );
        }
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : 'Failed to load form.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventId, gameId]);

  const maxCap =
    game?.participationType === 'individual' ? game.maxParticipants : game?.maxTeams ?? 0;
  const isFull = maxCap > 0 && entryCount >= maxCap;
  const windowOpen =
    Boolean(event && game) &&
    event?.status === 'registration_open' &&
    game?.registrationStatus === 'open' &&
    !isFull;

  const handleGoogleSignIn = async () => {
    setSubmitError(null);
    setSigningIn(true);
    try {
      await loginStudentWithGoogle();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to sign in with Google.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSaveOneTimeProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.email) return;
    setSetupError(null);

    const parsed = studentProfileSchema.safeParse({
      fullName: setupName,
      registrationNumber: setupRegNo,
      branch: setupBranch,
      batch: '',
      year: setupYear,
      semester: setupSemester,
      phone: setupPhone,
    });

    if (!parsed.success) {
      setSetupError(parsed.error.issues[0]?.message || 'Please complete all required profile fields.');
      return;
    }

    setSavingSetup(true);
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
      void logStudentActivity({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        studentName: saved.fullName,
        registrationNumber: saved.registrationNumber,
        action: 'profile_saved',
        summary: `Completed one-time student profile (${saved.registrationNumber}, ${saved.branch}, ${saved.year}, ${saved.semester || ''})`,
        path: `/register/${eventId || ''}/${gameId || ''}`,
        metadata: { branch: saved.branch, year: saved.year, semester: saved.semester || '' },
      });
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : 'Could not save your student profile.');
    } finally {
      setSavingSetup(false);
    }
  };

  const handleAddMember = () => {
    if (!game) return;
    if (1 + additionalMembers.length >= game.maxTeamSize) return;
    setAdditionalMembers((prev) => [
      ...prev,
      {
        fullName: '',
        enrollmentNumber: '',
        branch: '',
        year: '',
        roleLabel: '',
      },
    ]);
  };

  const handleRemoveMember = (index: number) => {
    setAdditionalMembers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMemberChange = (index: number, key: keyof TeamMember, value: string) => {
    setAdditionalMembers((prev) =>
      prev.map((m, idx) => (idx === index ? { ...m, [key]: value } : m))
    );
  };

  const handleCheckboxToggle = (fieldId: string, option: string) => {
    setCustomAnswers((prev) => {
      const current = Array.isArray(prev[fieldId]) ? (prev[fieldId] as string[]) : [];
      const next = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option];
      return { ...prev, [fieldId]: next };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !game) return;

    setSubmitError(null);
    const errors: Record<string, string> = {};

    const pParsed = participantSchema.safeParse(participant);
    if (!pParsed.success) {
      for (const issue of pParsed.error.issues) {
        const key = String(issue.path[0] || 'participant');
        errors[`participant.${key}`] = issue.message;
      }
    }

    const customErrs = validateCustomAnswers(game.customFields, customAnswers);
    for (const [k, msg] of Object.entries(customErrs)) {
      errors[`custom.${k}`] = msg;
    }

    if (!declarationAccepted) {
      errors.declaration = 'You must accept the declaration and privacy notice to submit.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitError('Please review the highlighted fields before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const enteredExtras = additionalMembers
        .filter((m) => m.fullName.trim().length > 0 || m.enrollmentNumber.trim().length > 0)
        .map((m, idx) => ({
          fullName: m.fullName.trim(),
          enrollmentNumber: m.enrollmentNumber.trim(),
          branch: '',
          year: '',
          roleLabel:
            m.roleLabel?.trim() ||
            (game.participationType === 'doubles' ? 'Partner' : `Member ${idx + 2}`),
        }));

      const allMembers: TeamMember[] =
        game.participationType === 'individual'
          ? []
          : [
              {
                fullName: participant.fullName.trim(),
                enrollmentNumber: participant.enrollmentNumber.trim(),
                branch: participant.branch,
                year: participant.year,
                roleLabel: game.participationType === 'doubles' ? 'Player 1' : 'Captain / Leader',
              },
              ...enteredExtras,
            ];

      const result = await submitRegistration({
        event,
        game,
        participant,
        team: {
          teamName: teamName.trim(),
          captainName: participant.fullName.trim(),
          captainEnrollment: participant.enrollmentNumber.trim(),
          members: allMembers,
        },
        customAnswers,
        declarationAccepted,
        studentUid: firebaseUser?.uid || '',
      });

      if (firebaseUser?.uid && firebaseUser?.email) {
        void logStudentActivity({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          studentName: participant.fullName,
          registrationNumber: result.enrollmentNumber,
          action: 'registration_submitted',
          summary: `Registered for ${event.name} — ${game.name} (Ref: ${result.registrationReference})`,
          path: `/register/${event.id}/${game.id}`,
          eventId: event.id,
          gameId: game.id,
          metadata: {
            registrationReference: result.registrationReference,
            participationType: game.participationType,
          },
        });
      }

      if (firebaseUser?.uid && firebaseUser?.email && !studentProfile) {
        try {
          const synced = await saveStudentProfile(firebaseUser.uid, firebaseUser.email, {
            fullName: participant.fullName,
            registrationNumber: participant.enrollmentNumber,
            branch: participant.branch,
            batch: '',
            year: participant.year,
            semester: participant.semester || '',
            phone: participant.phone,
          });
          setStudentProfileState(synced);
        } catch {
          // Registration succeeded; student can update profile later in Student Dashboard
        }
      }

      setConfirmation(result);
    } catch (err) {
      let msg =
        err instanceof Error ? err.message : 'Registration submission failed. Please try again.';
      if (msg.startsWith('{')) {
        try {
          const parsed = JSON.parse(msg) as {
            error?: string;
            code?: string;
            operationType?: string;
            path?: string;
          };
          if (parsed.error && parsed.error.toLowerCase().includes('permission')) {
            const diagParts = [
              parsed.code ? `code=${parsed.code}` : '',
              parsed.operationType ? `op=${parsed.operationType}` : '',
              parsed.path ? `path=${parsed.path}` : '',
            ]
              .filter(Boolean)
              .join(', ');
            msg = `Registration could not be completed due to a database permission check${diagParts ? ` (${diagParts})` : ''}. Please confirm you are signed in with Google and try submitting again.`;
          } else if (parsed.error) {
            msg = parsed.error;
          }
        } catch {
          // Keep original string if not valid JSON
        }
      }
      setSubmitError(msg);
      if (firebaseUser?.uid && firebaseUser?.email && !isStudentBlocked) {
        void logStudentActivity({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          studentName: participant.fullName,
          registrationNumber: participant.enrollmentNumber,
          action: 'registration_failed',
          summary: `Registration attempt failed for ${event.name} — ${game.name}: ${msg.slice(0, 180)}`,
          path: `/register/${event.id}/${game.id}`,
          eventId: event.id,
          gameId: game.id,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const darkInputClass =
    'w-full rounded-lg bg-[#080B14] border border-blue-500/35 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-red-400 focus:outline-none';

  return (
    <PublicLayout>
      <section className="bg-campus-tint min-h-[75vh]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link
            to={eventId && gameId ? `/events/${eventId}/games/${gameId}` : '/events'}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-300 hover:text-white mb-6 no-print"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {game?.name || 'Game Details'}</span>
          </Link>

          {loading || authLoading ? (
            <div className="h-96 card-3d rounded-2xl animate-pulse" />
          ) : loadError ? (
            <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-6 text-sm">
              {loadError}
            </div>
          ) : !event || !game ? (
            <div className="card-3d rounded-2xl p-10 text-center">
              <h1 className="font-display text-xl font-bold text-white">
                Event or Game Not Found
              </h1>
            </div>
          ) : confirmation ? (
            <div className="card-3d rounded-2xl p-8 space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-600/25 border border-blue-400/50 flex items-center justify-center text-blue-300 shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold text-white">
                    Registration Submitted Successfully
                  </h1>
                  <p className="mt-1 text-sm text-slate-300">
                    Your entry is confirmed! You can view all events and games you are
                    participating in and download certificates from your Student Dashboard.
                  </p>
                </div>
              </div>

              <div className="p-6 bg-[#080B14] border border-blue-500/30 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-blue-300">Registration Reference</p>
                  <p className="mt-1 font-mono text-xl font-bold text-white tabular-nums">
                    {confirmation.registrationReference}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-300">Participation Status</p>
                  <div className="mt-1">
                    <StatusTag status={confirmation.registrationStatus} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-blue-300">Event &amp; Discipline</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {event.name} — {game.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-300">Registration Number</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-white">
                    {confirmation.enrollmentNumber}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#080B14] border border-white/20 rounded-lg hover:border-blue-400"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Confirmation</span>
                </button>
                <div className="flex items-center gap-3">
                  <Link
                    to="/student"
                    className="px-4 py-2 text-sm font-semibold rounded-lg btn-3d-blue"
                  >
                    Open Student Dashboard
                  </Link>
                  <Link
                    to={`/events/${event.id}`}
                    className="px-4 py-2 text-sm font-medium text-red-300 hover:underline"
                  >
                    Register for Another Game
                  </Link>
                </div>
              </div>
            </div>
          ) : !windowOpen ? (
            <div className="card-3d rounded-2xl p-8 text-center">
              <h1 className="font-display text-2xl font-bold text-white">
                Registration Unavailable
              </h1>
              <p className="mt-2 text-sm text-slate-300 max-w-md mx-auto">
                {isFull
                  ? `Maximum capacity (${maxCap}) has been reached for ${game.name}.`
                  : `Registrations for ${game.name} in ${event.name} are currently closed.`}
              </p>
              <Link
                to={`/events/${event.id}`}
                className="mt-6 inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg btn-3d-blue"
              >
                Back to Event
              </Link>
            </div>
          ) : !firebaseUser ? (
            <div className="card-3d rounded-2xl p-8 sm:p-10 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#1D4ED8] flex items-center justify-center text-white mx-auto shadow-lg">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="max-w-lg mx-auto space-y-2">
                <p className="text-xs font-semibold text-blue-300">
                  {event.name} · {game.name}
                </p>
                <h1 className="font-display text-2xl font-bold text-white">
                  Sign In with Google to Register
                </h1>
                <p className="text-sm text-slate-300">
                  Sign in with your Google account first so your registration is linked to your
                  Student Dashboard and participation certificates.
                </p>
              </div>
              {(submitError || authError) && (
                <div className="max-w-md mx-auto bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-3 text-sm">
                  {submitError || authError}
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
                <h1 className="font-display text-2xl font-bold text-white">
                  Registration Restricted — Account Blocked
                </h1>
                <p className="text-sm text-red-200">
                  {studentAccount?.blockedReason ||
                    'Your student account has been blocked by the Sports Club Administrator and cannot submit event registrations.'}
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
          ) : !studentProfile ? (
            <form
              onSubmit={(e) => void handleSaveOneTimeProfile(e)}
              className="card-3d rounded-2xl p-6 sm:p-8 space-y-6"
            >
              <div className="flex items-start gap-3 pb-5 border-b border-white/10">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#DC2626] to-[#1D4ED8] flex items-center justify-center text-white shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-blue-300">
                    One-Time Setup · {event.name} · {game.name}
                  </p>
                  <h1 className="mt-1 font-display text-2xl font-bold text-white">
                    Complete Your Student Profile Once
                  </h1>
                  <p className="mt-1 text-xs text-slate-300">
                    Enter your academic details one time. They will automatically fill every sports
                    registration form going forward.
                  </p>
                </div>
              </div>

              {setupError && (
                <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-lg p-3.5 text-sm break-words overflow-hidden">
                  {setupError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="otp-name" className="block text-xs font-medium text-blue-200 mb-1">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="otp-name"
                    type="text"
                    required
                    value={setupName}
                    onChange={(e) => setSetupName(e.target.value)}
                    placeholder="e.g. Aarav Kumar"
                    className={darkInputClass}
                  />
                </div>

                <div>
                  <label htmlFor="otp-reg" className="block text-xs font-medium text-blue-200 mb-1">
                    Enrollment / Registration Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="otp-reg"
                    type="text"
                    required
                    value={setupRegNo}
                    onChange={(e) => setSetupRegNo(e.target.value)}
                    placeholder="e.g. 23105123001"
                    className={`${darkInputClass} font-mono uppercase`}
                  />
                </div>

                <div>
                  <label htmlFor="otp-branch" className="block text-xs font-medium text-blue-200 mb-1">
                    Branch <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="otp-branch"
                    value={setupBranch}
                    onChange={(e) => setSetupBranch(e.target.value)}
                    className={darkInputClass}
                  >
                    {settings.branches.map((b) => (
                      <option key={b} value={b} className="bg-[#0B101D] text-white">
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="otp-year" className="block text-xs font-medium text-blue-200 mb-1">
                    Year <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="otp-year"
                    value={setupYear}
                    onChange={(e) => setSetupYear(e.target.value)}
                    className={darkInputClass}
                  >
                    {settings.years.map((y) => (
                      <option key={y} value={y} className="bg-[#0B101D] text-white">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="otp-sem" className="block text-xs font-medium text-blue-200 mb-1">
                    Semester <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="otp-sem"
                    value={setupSemester}
                    onChange={(e) => setSetupSemester(e.target.value)}
                    className={darkInputClass}
                  >
                    {SEMESTER_OPTIONS.map((sem) => (
                      <option key={sem} value={sem} className="bg-[#0B101D] text-white">
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="otp-phone" className="block text-xs font-medium text-blue-200 mb-1">
                    Mobile Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="otp-phone"
                    type="tel"
                    required
                    value={setupPhone}
                    onChange={(e) => setSetupPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className={`${darkInputClass} font-mono`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="otp-email" className="block text-xs font-medium text-blue-200 mb-1">
                    Verified Google Email
                  </label>
                  <input
                    id="otp-email"
                    type="email"
                    readOnly
                    disabled
                    value={firebaseUser.email || ''}
                    className={`${darkInputClass} opacity-80 cursor-not-allowed`}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={savingSetup}
                  className="px-6 py-3 text-sm font-semibold rounded-xl btn-3d-blue disabled:opacity-60"
                >
                  {savingSetup ? 'Saving One-Time Profile...' : 'Save Profile & Open Registration Form'}
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              noValidate
              className="card-3d rounded-2xl p-6 sm:p-8 space-y-8"
            >
              <div className="pb-6 border-b border-white/10">
                <p className="text-xs font-medium text-blue-300">
                  {event.name} · {game.category} ·{' '}
                  {game.participationType === 'team'
                    ? `Team (${game.minTeamSize}–${game.maxTeamSize} players)`
                    : game.participationType === 'doubles'
                    ? 'Doubles (2 players)'
                    : 'Individual Entry'}
                </p>
                <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-white">
                  Register for {game.name}
                </h1>
                <p className="mt-1.5 text-sm text-slate-300">
                  Deadline:{' '}
                  <span className="tabular-nums text-red-300">
                    {formatDateTime(game.registrationDeadline)}
                  </span>
                </p>
              </div>

              {/* Auto-filled from My Profile Strip */}
              <div className="p-4 bg-blue-950/45 border border-blue-400/35 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-blue-100">
                  <UserCheck className="w-4 h-4 text-blue-300 shrink-0" />
                  <span>
                    Auto-filled from your saved profile ({studentProfile.registrationNumber}
                    {studentProfile.semester ? ` · ${studentProfile.semester}` : ''}).
                  </span>
                </div>
                <Link
                  to={`/student?profile=edit&redirect=${encodeURIComponent(
                    `/register/${event.id}/${game.id}`
                  )}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#080B14] border border-blue-400/40 rounded-lg hover:border-red-400"
                >
                  <Edit3 className="w-3.5 h-3.5 text-blue-300" />
                  <span>My Profile / Edit Profile</span>
                </Link>
              </div>

              {submitError && (
                <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-lg p-4 text-sm break-words overflow-hidden">
                  {submitError}
                </div>
              )}

              {/* Primary Participant / Captain Information */}
              <section className="space-y-4">
                <h2 className="font-display text-lg font-bold text-white">
                  {game.participationType === 'team'
                    ? 'Captain Details'
                    : game.participationType === 'doubles'
                    ? 'Player 1 (Primary Contact)'
                    : 'Participant Details'}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="block text-xs font-medium text-blue-200 mb-1">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      required
                      value={participant.fullName}
                      onChange={(e) => setParticipant({ ...participant, fullName: e.target.value })}
                      className={darkInputClass}
                      placeholder="e.g. Aarav Kumar"
                    />
                    {fieldErrors['participant.fullName'] && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors['participant.fullName']}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="enrollmentNumber"
                      className="block text-xs font-medium text-blue-200 mb-1"
                    >
                      Registration / Enrollment Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="enrollmentNumber"
                      type="text"
                      required
                      value={participant.enrollmentNumber}
                      onChange={(e) =>
                        setParticipant({ ...participant, enrollmentNumber: e.target.value })
                      }
                      className={`${darkInputClass} font-mono`}
                      placeholder="e.g. 23105123001"
                    />
                    {fieldErrors['participant.enrollmentNumber'] && (
                      <p className="mt-1 text-xs text-red-400">
                        {fieldErrors['participant.enrollmentNumber']}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="branch" className="block text-xs font-medium text-blue-200 mb-1">
                      Academic Branch <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="branch"
                      value={participant.branch}
                      onChange={(e) => setParticipant({ ...participant, branch: e.target.value })}
                      className={darkInputClass}
                    >
                      {!settings.branches.includes(participant.branch) && participant.branch && (
                        <option value={participant.branch} className="bg-[#0B101D] text-white">
                          {participant.branch}
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
                    <label htmlFor="year" className="block text-xs font-medium text-blue-200 mb-1">
                      Current Year <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="year"
                      value={participant.year}
                      onChange={(e) => setParticipant({ ...participant, year: e.target.value })}
                      className={darkInputClass}
                    >
                      {!settings.years.includes(participant.year) && participant.year && (
                        <option value={participant.year} className="bg-[#0B101D] text-white">
                          {participant.year}
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
                    <label htmlFor="semester" className="block text-xs font-medium text-blue-200 mb-1">
                      Semester
                    </label>
                    <select
                      id="semester"
                      value={participant.semester || ''}
                      onChange={(e) => setParticipant({ ...participant, semester: e.target.value })}
                      className={darkInputClass}
                    >
                      <option value="" className="bg-[#0B101D] text-white">
                        Select semester (optional)
                      </option>
                      {!SEMESTER_OPTIONS.includes(
                        (participant.semester || '') as (typeof SEMESTER_OPTIONS)[number]
                      ) &&
                        participant.semester && (
                          <option value={participant.semester} className="bg-[#0B101D] text-white">
                            {participant.semester}
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
                    <label htmlFor="phone" className="block text-xs font-medium text-blue-200 mb-1">
                      {game.participationType !== 'individual'
                        ? 'Leader Phone Number'
                        : 'Mobile Phone Number'}{' '}
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={participant.phone}
                      onChange={(e) => setParticipant({ ...participant, phone: e.target.value })}
                      className={`${darkInputClass} font-mono`}
                      placeholder="10-digit mobile number"
                    />
                    {fieldErrors['participant.phone'] && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors['participant.phone']}</p>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="email" className="block text-xs font-medium text-blue-200 mb-1">
                      Email Address (Verified Account)
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={participant.email}
                      onChange={(e) => setParticipant({ ...participant, email: e.target.value })}
                      className={darkInputClass}
                      placeholder="student@example.com"
                    />
                    {fieldErrors['participant.email'] && (
                      <p className="mt-1 text-xs text-red-400">{fieldErrors['participant.email']}</p>
                    )}
                  </div>
                </div>
              </section>

              {/* Team / Doubles Squad Roster */}
              {game.participationType !== 'individual' && (
                <section className="space-y-4 pt-6 border-t border-white/10">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-lg font-bold text-white">
                        {game.participationType === 'doubles'
                          ? 'Partner Details (Optional)'
                          : 'Team Name & Members (Optional)'}
                      </h2>
                      <p className="text-xs text-slate-300">
                        {game.participationType === 'doubles'
                          ? 'You may enter your partner name and registration number below (optional).'
                          : `Enter your team name and each member's Name and Registration Number below (${game.minTeamSize}–${game.maxTeamSize} players max). Member rows are optional — leave blank rows empty if needed.`}
                      </p>
                    </div>
                    {game.participationType === 'team' &&
                      1 + additionalMembers.length < game.maxTeamSize && (
                        <button
                          type="button"
                          onClick={handleAddMember}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#080B14] border border-blue-500/35 rounded-lg hover:border-red-400 whitespace-nowrap shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5 text-red-400" />
                          <span>Add Member</span>
                        </button>
                      )}
                  </div>

                  {game.participationType === 'team' && (
                    <div>
                      <label htmlFor="teamName" className="block text-xs font-medium text-blue-200 mb-1">
                        Team Name (Optional)
                      </label>
                      <input
                        id="teamName"
                        type="text"
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        placeholder="e.g. CSE Strikers (or leave blank to use Captain name)"
                        className={`${darkInputClass} sm:max-w-md`}
                      />
                    </div>
                  )}

                  <div className="space-y-3">
                    {additionalMembers.map((member, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-[#080B14] border border-blue-500/25 rounded-xl space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-blue-300">
                            {game.participationType === 'doubles'
                              ? 'Partner (Optional)'
                              : `Team Member #${idx + 2} (Optional)`}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(idx)}
                            className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Remove</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Member Name
                            </label>
                            <input
                              type="text"
                              value={member.fullName}
                              onChange={(e) => handleMemberChange(idx, 'fullName', e.target.value)}
                              placeholder="Enter teammate name (optional)"
                              className={darkInputClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-slate-300 mb-1">
                              Member Registration Number
                            </label>
                            <input
                              type="text"
                              value={member.enrollmentNumber}
                              onChange={(e) =>
                                handleMemberChange(idx, 'enrollmentNumber', e.target.value)
                              }
                              placeholder="e.g. 23105123002 (optional)"
                              className={`${darkInputClass} font-mono uppercase`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Dynamic Game-Specific Custom Fields */}
              {game.customFields.length > 0 && (
                <section className="space-y-4 pt-6 border-t border-white/10">
                  <h2 className="font-display text-lg font-bold text-white">
                    {game.name} Specific Questions
                  </h2>

                  <div className="space-y-4">
                    {[...game.customFields]
                      .sort((a, b) => a.order - b.order)
                      .map((field) => {
                        const err = fieldErrors[`custom.${field.id}`];
                        const val = customAnswers[field.id];

                        return (
                          <div key={field.id}>
                            <label
                              htmlFor={`cf_${field.id}`}
                              className="block text-xs font-medium text-blue-200 mb-1"
                            >
                              {field.label} {field.required && <span className="text-red-400">*</span>}
                            </label>
                            {field.helpText && (
                              <p className="text-xs text-slate-400 mb-1.5">{field.helpText}</p>
                            )}

                            {field.type === 'short_text' && (
                              <input
                                id={`cf_${field.id}`}
                                type="text"
                                value={String(val ?? '')}
                                onChange={(e) =>
                                  setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })
                                }
                                className={darkInputClass}
                              />
                            )}

                            {field.type === 'paragraph' && (
                              <textarea
                                id={`cf_${field.id}`}
                                rows={3}
                                value={String(val ?? '')}
                                onChange={(e) =>
                                  setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })
                                }
                                className={darkInputClass}
                              />
                            )}

                            {field.type === 'number' && (
                              <input
                                id={`cf_${field.id}`}
                                type="number"
                                value={String(val ?? '')}
                                onChange={(e) =>
                                  setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })
                                }
                                className={`${darkInputClass} sm:max-w-xs font-mono`}
                              />
                            )}

                            {field.type === 'date' && (
                              <input
                                id={`cf_${field.id}`}
                                type="date"
                                value={String(val ?? '')}
                                onChange={(e) =>
                                  setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })
                                }
                                className={`${darkInputClass} sm:max-w-xs`}
                              />
                            )}

                            {field.type === 'dropdown' && (
                              <select
                                id={`cf_${field.id}`}
                                value={String(val ?? '')}
                                onChange={(e) =>
                                  setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })
                                }
                                className={`${darkInputClass} sm:max-w-md`}
                              >
                                <option value="" className="bg-[#0B101D] text-white">
                                  Select an option...
                                </option>
                                {field.options.map((opt) => (
                                  <option key={opt} value={opt} className="bg-[#0B101D] text-white">
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            )}

                            {field.type === 'single_choice' && (
                              <div className="space-y-2 pt-1">
                                {field.options.map((opt) => (
                                  <label
                                    key={opt}
                                    className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer"
                                  >
                                    <input
                                      type="radio"
                                      name={`cf_${field.id}`}
                                      checked={val === opt}
                                      onChange={() =>
                                        setCustomAnswers({ ...customAnswers, [field.id]: opt })
                                      }
                                      className="accent-red-500"
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>
                            )}

                            {field.type === 'checkboxes' && (
                              <div className="space-y-2 pt-1">
                                {field.options.map((opt) => {
                                  const arr = Array.isArray(val) ? val : [];
                                  return (
                                    <label
                                      key={opt}
                                      className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={arr.includes(opt)}
                                        onChange={() => handleCheckboxToggle(field.id, opt)}
                                        className="accent-red-500"
                                      />
                                      <span>{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
                          </div>
                        );
                      })}
                  </div>
                </section>
              )}

              {/* Privacy Notice & Declaration */}
              <section className="pt-6 border-t border-white/10 space-y-4">
                <div className="p-4 bg-[#080B14] border border-blue-500/25 rounded-lg text-xs text-slate-300 leading-relaxed">
                  <p className="font-semibold text-blue-300 mb-1">Privacy &amp; Data Use Notice</p>
                  <p>{settings.privacyText}</p>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={declarationAccepted}
                    onChange={(e) => setDeclarationAccepted(e.target.checked)}
                    className="mt-1 accent-red-500"
                  />
                  <span className="text-sm text-slate-200">
                    I confirm that all details provided above belong to bona fide students of{' '}
                    {settings.institutionName}, and I agree to abide by the rules of the Sports Club.
                  </span>
                </label>
                {fieldErrors.declaration && (
                  <p className="text-xs text-red-400">{fieldErrors.declaration}</p>
                )}
              </section>

              <div className="pt-4 flex items-center justify-end gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 text-sm font-semibold rounded-xl btn-3d-red disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {submitting ? 'Submitting Registration...' : 'Submit Registration'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

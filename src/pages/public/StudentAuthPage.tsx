import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Award, Ban, CheckCircle2, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { logStudentActivity, saveStudentProfile } from '@/src/services/firebase/students';
import { SEMESTER_OPTIONS, studentProfileSchema } from '@/src/schemas/validation';

export function StudentAuthPage() {
  const {
    firebaseUser,
    studentProfile,
    studentAccount,
    isStudentBlocked,
    loading,
    authError,
    loginStudentWithGoogle,
    setStudentProfileState,
    logout,
  } = useAuth();
  const { settings } = useSiteSettings();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const rawRedirect = searchParams.get('redirect') || '';
  const redirectTarget =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/student';
  const forceEdit = searchParams.get('edit') === '1';

  const [fullName, setFullName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [branch, setBranch] = useState(settings.branches[0] || 'CSE (IoT)');
  const [year, setYear] = useState(settings.years[0] || '1st Year');
  const [semester, setSemester] = useState<string>(SEMESTER_OPTIONS[0]);
  const [phone, setPhone] = useState('');

  const [signingIn, setSigningIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Returning student with saved profile: never ask for details again unless ?edit=1
  useEffect(() => {
    if (!loading && firebaseUser && !isStudentBlocked && studentProfile && !forceEdit) {
      navigate(redirectTarget, { replace: true });
    }
  }, [loading, firebaseUser, isStudentBlocked, studentProfile, forceEdit, navigate, redirectTarget]);

  useEffect(() => {
    if (studentProfile) {
      setFullName(studentProfile.fullName);
      setRegistrationNumber(studentProfile.registrationNumber);
      setBranch(studentProfile.branch || settings.branches[0] || 'CSE (IoT)');
      setYear(studentProfile.year || settings.years[0] || '1st Year');
      setSemester(studentProfile.semester || SEMESTER_OPTIONS[0]);
      setPhone(studentProfile.phone || '');
    } else if (firebaseUser) {
      setFullName((prev) => prev || firebaseUser.displayName || '');
    }
  }, [studentProfile, firebaseUser, settings.branches, settings.years]);

  const handleGoogleLogin = async () => {
    setError(null);
    setSigningIn(true);
    try {
      const res = await loginStudentWithGoogle();
      if (res?.profile && !forceEdit) {
        navigate(redirectTarget, { replace: true });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete student sign-in.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !firebaseUser.email) return;

    setError(null);
    setSavedNotice(null);

    if (phone.trim().replace(/\D/g, '').length < 10) {
      setError('Please enter your 10-digit mobile number.');
      return;
    }

    const parsed = studentProfileSchema.safeParse({
      fullName,
      registrationNumber,
      branch,
      batch: '',
      year,
      semester,
      phone,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Please check your student details.');
      return;
    }

    setSaving(true);
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
        summary: `Saved student profile (${saved.registrationNumber}, ${saved.branch}, ${saved.year}${saved.semester ? `, ${saved.semester}` : ''})`,
        path: '/student/login',
        metadata: { branch: saved.branch, year: saved.year, semester: saved.semester || '' },
      });
      setSavedNotice('One-time profile saved! Redirecting...');
      setTimeout(() => navigate(redirectTarget, { replace: true }), 450);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save student profile.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg bg-[#080B14] border border-blue-500/35 px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-red-400 focus:outline-none';

  return (
    <PublicLayout>
      <section className="bg-subpage-arena text-white py-12 border-b border-blue-500/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
            {settings.clubName}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold">
            {firebaseUser && !studentProfile
              ? 'Complete Your One-Time Student Profile'
              : 'Student Login & Profile Setup'}
          </h1>
          <p className="mt-2 text-sm text-slate-300 max-w-2xl">
            Sign in with Google and save your details once — all future sports registrations will
            auto-fill automatically, and your participation &amp; certificates stay synced.
          </p>
        </div>
      </section>

      <section className="bg-campus-tint min-h-[60vh]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {loading ? (
            <div className="h-64 card-3d rounded-2xl animate-pulse" />
          ) : !firebaseUser ? (
            <div className="card-3d rounded-2xl p-8 sm:p-10 text-center space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#1D4ED8] flex items-center justify-center text-white mx-auto shadow-lg">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
                <h2 className="font-display text-2xl font-bold text-white">
                  Sign In with Google
                </h2>
                <p className="text-sm text-slate-300">
                  Returning students are taken straight to their dashboard with details auto-loaded.
                  First-time students save their profile once and never have to re-enter it.
                </p>
              </div>

              {(error || authError) && (
                <div className="max-w-md mx-auto bg-red-950/70 border border-red-500/40 text-red-200 rounded-xl p-3 text-sm break-words overflow-hidden">
                  {error || authError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={() => void handleGoogleLogin()}
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold rounded-xl btn-3d-mix disabled:opacity-60"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>{signingIn ? 'Signing in...' : 'Continue with Google'}</span>
                </button>
              </div>
            </div>
          ) : isStudentBlocked ? (
            <div className="card-3d rounded-2xl p-8 sm:p-10 text-center space-y-5 border border-red-500/40">
              <div className="w-14 h-14 rounded-2xl bg-red-950 border border-red-500/50 flex items-center justify-center text-red-400 mx-auto">
                <Ban className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-2">
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
            <div className="space-y-6">
              <div className="card-3d-blue rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-blue-300">Signed-in Student Account</p>
                  <p className="text-sm font-bold text-white">
                    {firebaseUser.displayName || 'Student'} ({firebaseUser.email})
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {studentProfile && (
                    <Link
                      to="/student"
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg btn-3d-red"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Open Student Dashboard</span>
                    </Link>
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

              <form
                onSubmit={(e) => void handleSaveProfile(e)}
                className="card-3d rounded-2xl p-6 sm:p-8 space-y-6"
              >
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    {studentProfile
                      ? 'Update Your Student Profile'
                      : 'Complete Your One-Time Student Profile'}
                  </h2>
                  <p className="mt-1 text-xs text-slate-300">
                    Enter your academic and contact details once. Every sports registration form will
                    auto-fill from this profile, and you can edit it anytime from My Profile.
                  </p>
                </div>

                {error && (
                  <div className="bg-red-950/70 border border-red-500/40 text-red-200 rounded-lg p-3.5 text-sm break-words overflow-hidden">
                    {error}
                  </div>
                )}

                {savedNotice && (
                  <div className="bg-blue-950/70 border border-blue-400/50 text-blue-100 rounded-lg p-3.5 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-300 shrink-0" />
                    <span>{savedNotice}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sp-name" className="block text-xs font-medium text-blue-200 mb-1">
                      Full Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="sp-name"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Aarav Kumar"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="sp-reg" className="block text-xs font-medium text-blue-200 mb-1">
                      Enrollment / Registration Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="sp-reg"
                      type="text"
                      required
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g. 23105123001"
                      className={`${inputClass} font-mono uppercase`}
                    />
                  </div>

                  <div>
                    <label htmlFor="sp-branch" className="block text-xs font-medium text-blue-200 mb-1">
                      Branch <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="sp-branch"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className={inputClass}
                    >
                      {!settings.branches.includes(branch) && branch && (
                        <option value={branch} className="bg-[#0B101D] text-white">
                          {branch}
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
                    <label htmlFor="sp-year" className="block text-xs font-medium text-blue-200 mb-1">
                      Year <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="sp-year"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className={inputClass}
                    >
                      {!settings.years.includes(year) && year && (
                        <option value={year} className="bg-[#0B101D] text-white">
                          {year}
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
                    <label htmlFor="sp-sem" className="block text-xs font-medium text-blue-200 mb-1">
                      Semester <span className="text-red-400">*</span>
                    </label>
                    <select
                      id="sp-sem"
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      className={inputClass}
                    >
                      {!SEMESTER_OPTIONS.includes(semester as (typeof SEMESTER_OPTIONS)[number]) &&
                        semester && (
                          <option value={semester} className="bg-[#0B101D] text-white">
                            {semester}
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
                    <label htmlFor="sp-phone" className="block text-xs font-medium text-blue-200 mb-1">
                      Mobile Number <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="sp-phone"
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className={`${inputClass} font-mono`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="sp-email" className="block text-xs font-medium text-blue-200 mb-1">
                      Verified Google Email
                    </label>
                    <input
                      id="sp-email"
                      type="email"
                      readOnly
                      disabled
                      value={firebaseUser.email || ''}
                      className={`${inputClass} opacity-80 cursor-not-allowed`}
                    />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
                  <Link
                    to="/events"
                    className="px-4 py-2.5 text-sm font-medium text-slate-200 bg-[#080B14] border border-white/15 rounded-lg hover:border-blue-400"
                  >
                    Browse Events
                  </Link>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg btn-3d-blue disabled:opacity-60"
                  >
                    <span>
                      {saving
                        ? 'Saving Profile...'
                        : studentProfile
                        ? 'Save Profile Updates'
                        : 'Save One-Time Profile & Continue'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

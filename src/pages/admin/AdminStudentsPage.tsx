import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Award,
  Ban,
  CheckCircle2,
  Eye,
  LogIn,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag } from '@/src/components/common/StatusBadge';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { listRegistrationsForAdmin } from '@/src/services/firebase/registrations';
import { listAllCertificatesForAdmin } from '@/src/services/firebase/certificates';
import {
  listAllStudentAccountsForAdmin,
  listAllStudentActivityForAdmin,
  listAllStudentProfilesForAdmin,
  listStudentActivityByUid,
  removeStudentRecord,
  setStudentBlockStatus,
} from '@/src/services/firebase/students';
import { formatDateTime } from '@/src/utils/formatters';
import { normalizeEnrollment } from '@/src/schemas/validation';
import type {
  IssuedCertificate,
  Registration,
  StudentAccount,
  StudentActivity,
  StudentActivityAction,
  StudentProfile,
} from '@/src/types/models';

interface MergedStudentRow {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  fullName: string;
  registrationNumber: string;
  branch: string;
  year: string;
  semester: string;
  phone: string;
  profileCompleted: boolean;
  status: 'active' | 'blocked';
  blockedReason: string;
  blockedByName: string;
  loginCount: number;
  lastLoginAtMs: number;
  lastActiveAtMs: number;
  lastLoginText: string;
  lastActiveText: string;
  hasAccountDoc: boolean;
  account: StudentAccount | null;
  profile: StudentProfile | null;
}

const ACTION_BADGE_MAP: Record<
  StudentActivityAction,
  { label: string; className: string }
> = {
  login: { label: 'Login', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  logout: { label: 'Logout', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  profile_saved: {
    label: 'Profile Saved',
    className: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  page_view: { label: 'Page View', className: 'bg-slate-50 text-slate-700 border-slate-200' },
  registration_submitted: {
    label: 'Registered',
    className: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  registration_failed: {
    label: 'Reg Failed',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  certificate_preview: {
    label: 'Cert Preview',
    className: 'bg-purple-50 text-purple-800 border-purple-200',
  },
  certificate_download: {
    label: 'Cert Download',
    className: 'bg-orange-50 text-orange-800 border-orange-200',
  },
  blocked_access_attempt: {
    label: 'Blocked Attempt',
    className: 'bg-red-50 text-red-800 border-red-200',
  },
  admin_block: { label: 'Admin Block', className: 'bg-red-100 text-red-900 border-red-300' },
  admin_unblock: {
    label: 'Admin Unblock',
    className: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  },
  admin_remove: { label: 'Admin Remove', className: 'bg-red-100 text-red-900 border-red-300' },
};

export function AdminStudentsPage() {
  const { adminProfile } = useAuth();
  const { settings } = useSiteSettings();

  const [activeTab, setActiveTab] = useState<'students' | 'activity'>('students');
  const [accounts, setAccounts] = useState<StudentAccount[]>([]);
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [activities, setActivities] = useState<StudentActivity[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [certificates, setCertificates] = useState<IssuedCertificate[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters for Students Tab
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
  const [profileFilter, setProfileFilter] = useState<'all' | 'completed' | 'incomplete'>('all');
  const [branchFilter, setBranchFilter] = useState('all');

  // Filters for Activity Tab
  const [activitySearch, setActivitySearch] = useState('');
  const [activityCategory, setActivityCategory] = useState('all');

  // Modals
  const [inspectingStudent, setInspectingStudent] = useState<MergedStudentRow | null>(null);
  const [inspectActivities, setInspectActivities] = useState<StudentActivity[]>([]);
  const [loadingInspectActivities, setLoadingInspectActivities] = useState(false);

  const [blockTarget, setBlockTarget] = useState<MergedStudentRow | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<MergedStudentRow | null>(null);
  const [alsoDeleteRegs, setAlsoDeleteRegs] = useState(false);
  const [removing, setRemoving] = useState(false);

  const canModerate =
    adminProfile?.role === 'super_admin' || adminProfile?.role === 'event_admin';
  const maskPii = adminProfile?.role === 'coordinator';

  const loadAll = useCallback(async () => {
    if (!adminProfile) return;
    setLoading(true);
    setError(null);
    try {
      const [acctList, profList, actList, regList, certList] = await Promise.all([
        listAllStudentAccountsForAdmin(),
        listAllStudentProfilesForAdmin(),
        listAllStudentActivityForAdmin(350),
        listRegistrationsForAdmin(adminProfile),
        listAllCertificatesForAdmin(adminProfile),
      ]);
      setAccounts(acctList);
      setProfiles(profList);
      setActivities(actList);
      setRegistrations(regList);
      setCertificates(certList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load student accounts and activity.');
    } finally {
      setLoading(false);
    }
  }, [adminProfile]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const mergedStudents = useMemo<MergedStudentRow[]>(() => {
    const profileByUid = new Map<string, StudentProfile>();
    for (const p of profiles) {
      profileByUid.set(p.uid, p);
    }

    const rowMap = new Map<string, MergedStudentRow>();

    for (const a of accounts) {
      const p = profileByUid.get(a.uid) || null;
      const fullName = p?.fullName || a.fullName || '';
      const regNo = p?.registrationNumber || a.registrationNumber || '';
      const branch = p?.branch || a.branch || '';
      const year = p?.year || a.year || '';
      const semester = p?.semester || a.semester || '';
      const phone = p?.phone || a.phone || '';
      const lastLoginMs = a.lastLoginAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const lastActiveMs = a.lastActiveAt?.toMillis?.() ?? lastLoginMs;

      rowMap.set(a.uid, {
        uid: a.uid,
        email: a.email,
        displayName: fullName || a.displayName || a.email,
        photoUrl: a.photoUrl || '',
        fullName,
        registrationNumber: regNo,
        branch,
        year,
        semester,
        phone,
        profileCompleted: Boolean(p) || a.profileCompleted,
        status: a.status === 'blocked' ? 'blocked' : 'active',
        blockedReason: a.blockedReason || '',
        blockedByName: a.blockedByName || '',
        loginCount: a.loginCount || 1,
        lastLoginAtMs: lastLoginMs,
        lastActiveAtMs: lastActiveMs,
        lastLoginText: formatDateTime(a.lastLoginAt || a.createdAt),
        lastActiveText: formatDateTime(a.lastActiveAt || a.lastLoginAt || a.createdAt),
        hasAccountDoc: true,
        account: a,
        profile: p,
      });
    }

    // Include legacy studentProfiles created before studentAccounts existed
    for (const p of profiles) {
      if (rowMap.has(p.uid)) continue;
      const ms = p.updatedAt?.toMillis?.() ?? p.createdAt?.toMillis?.() ?? 0;
      rowMap.set(p.uid, {
        uid: p.uid,
        email: p.email,
        displayName: p.fullName || p.email,
        photoUrl: '',
        fullName: p.fullName,
        registrationNumber: p.registrationNumber,
        branch: p.branch,
        year: p.year,
        semester: p.semester || '',
        phone: p.phone,
        profileCompleted: true,
        status: 'active',
        blockedReason: '',
        blockedByName: '',
        loginCount: 1,
        lastLoginAtMs: ms,
        lastActiveAtMs: ms,
        lastLoginText: formatDateTime(p.createdAt),
        lastActiveText: formatDateTime(p.updatedAt || p.createdAt),
        hasAccountDoc: false,
        account: null,
        profile: p,
      });
    }

    return Array.from(rowMap.values()).sort(
      (a, b) => (b.lastActiveAtMs || b.lastLoginAtMs) - (a.lastActiveAtMs || a.lastLoginAtMs)
    );
  }, [accounts, profiles]);

  const regsByStudentUidOrRegNo = useMemo(() => {
    const map = new Map<string, Registration[]>();
    for (const r of registrations) {
      if (r.studentUid) {
        const list = map.get(`uid:${r.studentUid}`) || [];
        list.push(r);
        map.set(`uid:${r.studentUid}`, list);
      }
      const norm = normalizeEnrollment(r.participant.enrollmentNumber);
      if (norm) {
        const list = map.get(`reg:${norm}`) || [];
        list.push(r);
        map.set(`reg:${norm}`, list);
      }
    }
    return map;
  }, [registrations]);

  const getStudentRegistrations = useCallback(
    (student: MergedStudentRow): Registration[] => {
      const seen = new Map<string, Registration>();
      for (const r of regsByStudentUidOrRegNo.get(`uid:${student.uid}`) || []) {
        seen.set(r.id, r);
      }
      if (student.registrationNumber) {
        const norm = normalizeEnrollment(student.registrationNumber);
        for (const r of regsByStudentUidOrRegNo.get(`reg:${norm}`) || []) {
          seen.set(r.id, r);
        }
      }
      return Array.from(seen.values());
    },
    [regsByStudentUidOrRegNo]
  );

  const getStudentCertificates = useCallback(
    (student: MergedStudentRow): IssuedCertificate[] => {
      const normReg = student.registrationNumber
        ? normalizeEnrollment(student.registrationNumber)
        : '';
      return certificates.filter(
        (c) =>
          (c.studentUid && c.studentUid === student.uid) ||
          (normReg && normalizeEnrollment(c.registrationNumber) === normReg)
      );
    },
    [certificates]
  );

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mergedStudents.filter((s) => {
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (profileFilter === 'completed' && !s.profileCompleted) return false;
      if (profileFilter === 'incomplete' && s.profileCompleted) return false;
      if (branchFilter !== 'all' && s.branch !== branchFilter) return false;
      if (q) {
        const hay = `${s.displayName} ${s.fullName} ${s.email} ${s.registrationNumber} ${s.branch} ${s.year} ${s.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [mergedStudents, search, statusFilter, profileFilter, branchFilter]);

  const filteredActivity = useMemo(() => {
    const q = activitySearch.trim().toLowerCase();
    return activities.filter((a) => {
      if (activityCategory === 'auth' && !['login', 'logout'].includes(a.action)) return false;
      if (activityCategory === 'profile' && a.action !== 'profile_saved') return false;
      if (
        activityCategory === 'registration' &&
        !['registration_submitted', 'registration_failed'].includes(a.action)
      ) {
        return false;
      }
      if (
        activityCategory === 'certificate' &&
        !['certificate_preview', 'certificate_download'].includes(a.action)
      ) {
        return false;
      }
      if (activityCategory === 'page_view' && a.action !== 'page_view') return false;
      if (
        activityCategory === 'moderation' &&
        !['blocked_access_attempt', 'admin_block', 'admin_unblock', 'admin_remove'].includes(
          a.action
        )
      ) {
        return false;
      }

      if (q) {
        const hay = `${a.studentName} ${a.email} ${a.registrationNumber} ${a.summary} ${a.path} ${a.action}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activities, activitySearch, activityCategory]);

  const kpi = useMemo(() => {
    const total = mergedStudents.length;
    const completed = mergedStudents.filter((s) => s.profileCompleted).length;
    const blocked = mergedStudents.filter((s) => s.status === 'blocked').length;
    const active = total - blocked;
    return { total, completed, active, blocked };
  }, [mergedStudents]);

  const handleOpenInspect = async (student: MergedStudentRow) => {
    setInspectingStudent(student);
    setLoadingInspectActivities(true);
    setInspectActivities([]);
    try {
      const list = await listStudentActivityByUid(student.uid, 150);
      setInspectActivities(list);
    } catch {
      setInspectActivities(activities.filter((a) => a.uid === student.uid));
    } finally {
      setLoadingInspectActivities(false);
    }
  };

  const handleConfirmBlockToggle = async () => {
    if (!adminProfile || !blockTarget) return;
    if (!blockTarget.account) {
      setError(
        'This legacy profile has not signed in since login tracking was enabled, so a Google login account document does not exist yet to block.'
      );
      setBlockTarget(null);
      return;
    }

    const willBlock = blockTarget.status !== 'blocked';
    setSavingBlock(true);
    setError(null);
    setNotice(null);
    try {
      await setStudentBlockStatus({
        target: blockTarget.account,
        block: willBlock,
        reason: blockReason,
        actor: adminProfile,
      });
      setNotice(
        `${blockTarget.displayName} (${blockTarget.email}) has been ${
          willBlock ? 'blocked' : 'unblocked'
        }.`
      );
      setBlockTarget(null);
      setBlockReason('');
      await loadAll();
      if (inspectingStudent?.uid === blockTarget.uid) {
        setInspectingStudent(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update student block status.');
    } finally {
      setSavingBlock(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!adminProfile || !removeTarget) return;
    setRemoving(true);
    setError(null);
    setNotice(null);
    try {
      const studentRegs = getStudentRegistrations(removeTarget);
      const res = await removeStudentRecord({
        uid: removeTarget.uid,
        email: removeTarget.email,
        displayName: removeTarget.displayName,
        registrationNumber: removeTarget.registrationNumber,
        alsoDeleteRegistrations: alsoDeleteRegs,
        registrations: studentRegs,
        actor: adminProfile,
      });
      setNotice(
        `Removed student ${removeTarget.displayName} (${removeTarget.email})${
          res.removedRegistrations > 0
            ? ` along with ${res.removedRegistrations} registration(s)`
            : ''
        }.`
      );
      setRemoveTarget(null);
      setAlsoDeleteRegs(false);
      if (inspectingStudent?.uid === removeTarget.uid) {
        setInspectingStudent(null);
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove student record.');
    } finally {
      setRemoving(false);
    }
  };

  const inputClass =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400';

  return (
    <AdminLayout title="Student Logins & Activity" breadcrumb="Administration / Student Monitoring">
      <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
        {notice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Logged-In Students</p>
              <p className="mt-1.5 font-display text-3xl font-bold text-[#142D50] tabular-nums">
                {loading ? '—' : kpi.total}
              </p>
            </div>
            <Users className="w-7 h-7 text-[#142D50]/70" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Registered Profiles Saved</p>
              <p className="mt-1.5 font-display text-3xl font-bold text-blue-700 tabular-nums">
                {loading ? '—' : kpi.completed}
              </p>
            </div>
            <UserCheck className="w-7 h-7 text-blue-600/70" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Active Student Accounts</p>
              <p className="mt-1.5 font-display text-3xl font-bold text-emerald-700 tabular-nums">
                {loading ? '—' : kpi.active}
              </p>
            </div>
            <ShieldCheck className="w-7 h-7 text-emerald-600/70" />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Blocked Students</p>
              <p className="mt-1.5 font-display text-3xl font-bold text-red-700 tabular-nums">
                {loading ? '—' : kpi.blocked}
              </p>
            </div>
            <Ban className="w-7 h-7 text-red-600/70" />
          </div>
        </div>

        {/* Tabs & Refresh */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('students')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'students'
                  ? 'bg-[#142D50] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Logged-In Students &amp; Profiles ({mergedStudents.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'activity'
                  ? 'bg-[#142D50] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>All User Activity Feed ({activities.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg hover:bg-slate-100 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
        </div>

        {activeTab === 'students' ? (
          <div className="space-y-4">
            {/* Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, reg no, phone..."
                  className={`${inputClass} w-full pl-9`}
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'blocked')}
                className={inputClass}
              >
                <option value="all">All Account Statuses</option>
                <option value="active">Active Students Only</option>
                <option value="blocked">Blocked Students Only</option>
              </select>

              <select
                value={profileFilter}
                onChange={(e) =>
                  setProfileFilter(e.target.value as 'all' | 'completed' | 'incomplete')
                }
                className={inputClass}
              >
                <option value="all">All Profile States</option>
                <option value="completed">Profile Saved</option>
                <option value="incomplete">Google Login Only (No Profile Yet)</option>
              </select>

              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className={inputClass}
              >
                <option value="all">All Branches</option>
                {settings.branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Students Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {loading ? (
                <div className="p-8 text-sm text-slate-500">Loading student login records...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No logged-in student records match your current filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Student / Google Account</th>
                        <th className="py-3 px-4">Registered Profile Details</th>
                        <th className="py-3 px-4">Logins &amp; Entries</th>
                        <th className="py-3 px-4">Last Active</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredStudents.map((s) => {
                        const studentRegs = getStudentRegistrations(s);
                        const studentCerts = getStudentCertificates(s);
                        return (
                          <tr key={s.uid} className="hover:bg-slate-50">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                {s.photoUrl ? (
                                  <img
                                    src={s.photoUrl}
                                    alt={s.displayName}
                                    className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-[#142D50]/10 text-[#142D50] font-bold text-xs flex items-center justify-center shrink-0">
                                    {(s.displayName || 'S').charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-[#142D50] truncate">
                                    {s.displayName}
                                  </p>
                                  <p className="text-xs text-slate-500 truncate">
                                    {maskPii ? 'Hidden (Coordinator)' : s.email}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="py-3 px-4">
                              {s.profileCompleted ? (
                                <div>
                                  <p className="font-mono text-xs font-semibold text-slate-900">
                                    {s.registrationNumber}
                                  </p>
                                  <p className="text-xs text-slate-600">
                                    {s.branch} · {s.year}
                                    {s.semester ? ` · ${s.semester}` : ''}
                                  </p>
                                  <p className="text-xs font-mono text-slate-500">
                                    {maskPii ? 'Phone masked' : s.phone || '—'}
                                  </p>
                                </div>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                  Google Login Only · Profile Incomplete
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-xs text-slate-700">
                              <p className="font-medium">
                                <span className="font-mono font-bold text-[#142D50]">
                                  {s.loginCount}
                                </span>{' '}
                                login{s.loginCount === 1 ? '' : 's'}
                              </p>
                              <p className="text-slate-500">
                                {studentRegs.length} registration{studentRegs.length === 1 ? '' : 's'}
                                {studentCerts.length > 0 ? ` · ${studentCerts.length} cert` : ''}
                              </p>
                            </td>

                            <td className="py-3 px-4 text-xs text-slate-600 tabular-nums">
                              {s.lastActiveText}
                            </td>

                            <td className="py-3 px-4">
                              {s.status === 'blocked' ? (
                                <div>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-red-100 text-red-800 border border-red-200">
                                    <Ban className="w-3 h-3" />
                                    <span>Blocked</span>
                                  </span>
                                  {s.blockedReason && (
                                    <p className="mt-1 text-[11px] text-red-700 max-w-[180px] truncate">
                                      {s.blockedReason}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Active</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => void handleOpenInspect(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#142D50] bg-slate-100 rounded-lg hover:bg-slate-200"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Activity</span>
                                </button>

                                {canModerate && s.hasAccountDoc && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBlockTarget(s);
                                      setBlockReason(s.blockedReason || '');
                                    }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border ${
                                      s.status === 'blocked'
                                        ? 'text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                                        : 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100'
                                    }`}
                                  >
                                    {s.status === 'blocked' ? (
                                      <>
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        <span>Unblock</span>
                                      </>
                                    ) : (
                                      <>
                                        <Ban className="w-3.5 h-3.5" />
                                        <span>Block</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {canModerate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRemoveTarget(s);
                                      setAlsoDeleteRegs(false);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Remove</span>
                                  </button>
                                )}
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
        ) : (
          <div className="space-y-4">
            {/* Activity Filters */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={activitySearch}
                  onChange={(e) => setActivitySearch(e.target.value)}
                  placeholder="Search student, email, reg no, page, or action..."
                  className={`${inputClass} w-full pl-9`}
                />
              </div>

              <select
                value={activityCategory}
                onChange={(e) => setActivityCategory(e.target.value)}
                className={inputClass}
              >
                <option value="all">All Activity Types</option>
                <option value="auth">Logins &amp; Logouts</option>
                <option value="profile">Profile Saves &amp; Edits</option>
                <option value="registration">Event Registrations</option>
                <option value="certificate">Certificate Previews &amp; Downloads</option>
                <option value="page_view">Website Page Views</option>
                <option value="moderation">Blocked Attempts &amp; Admin Moderation</option>
              </select>
            </div>

            {/* Activity Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {loading ? (
                <div className="p-8 text-sm text-slate-500">Loading user activity feed...</div>
              ) : filteredActivity.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  No user activity matches your current filter.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4">Details &amp; Page</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredActivity.map((act) => {
                        const badge = ACTION_BADGE_MAP[act.action] || {
                          label: act.action,
                          className: 'bg-slate-100 text-slate-700 border-slate-200',
                        };
                        return (
                          <tr key={act.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                              {formatDateTime(act.createdAt)}
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-[#142D50] text-xs">
                                {act.studentName || act.email}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {maskPii ? 'Email hidden' : act.email}
                                {act.registrationNumber ? ` · ${act.registrationNumber}` : ''}
                              </p>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-md border ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-xs font-medium text-slate-900">{act.summary}</p>
                              {act.path && (
                                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                                  {act.path}
                                </p>
                              )}
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
        )}
      </div>

      {/* Student 360 Inspector Modal */}
      {inspectingStudent && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setInspectingStudent(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 bg-slate-50">
              <div>
                <p className="text-xs font-semibold text-[#F28C28]">Student Profile &amp; Activity</p>
                <h2 className="font-display text-lg font-bold text-[#142D50]">
                  {inspectingStudent.displayName} ({maskPii ? 'Email masked' : inspectingStudent.email})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInspectingStudent(null)}
                className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-200"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Registered Profile Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div>
                  <p className="text-slate-500">Full Name</p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {inspectingStudent.fullName || inspectingStudent.displayName || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Registration Number</p>
                  <p className="mt-0.5 font-mono font-semibold text-slate-900">
                    {inspectingStudent.registrationNumber || 'Not filled yet'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Branch, Year &amp; Semester</p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {inspectingStudent.branch
                      ? `${inspectingStudent.branch} · ${inspectingStudent.year}${
                          inspectingStudent.semester ? ` · ${inspectingStudent.semester}` : ''
                        }`
                      : 'Not filled yet'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Phone Number</p>
                  <p className="mt-0.5 font-mono font-semibold text-slate-900">
                    {maskPii ? 'Masked' : inspectingStudent.phone || 'Not filled yet'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Google Logins</p>
                  <p className="mt-0.5 font-semibold text-slate-900">
                    {inspectingStudent.loginCount} time(s) · Last: {inspectingStudent.lastLoginText}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Account Status</p>
                  <p
                    className={`mt-0.5 font-bold ${
                      inspectingStudent.status === 'blocked' ? 'text-red-700' : 'text-emerald-700'
                    }`}
                  >
                    {inspectingStudent.status === 'blocked'
                      ? `Blocked (${inspectingStudent.blockedReason || 'No reason'})`
                      : 'Active'}
                  </p>
                </div>
              </div>

              {/* Event Registrations */}
              <div>
                <h3 className="text-sm font-bold text-[#142D50] mb-2">
                  Event Registrations ({getStudentRegistrations(inspectingStudent).length})
                </h3>
                {getStudentRegistrations(inspectingStudent).length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    No event or game registrations found for this student.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                    {getStudentRegistrations(inspectingStudent).map((r) => (
                      <div
                        key={r.id}
                        className="p-3 bg-white flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <Link
                            to={`/admin/registrations/${r.id}`}
                            className="font-semibold text-[#142D50] hover:underline"
                          >
                            {r.eventName} — {r.gameName}
                          </Link>
                          <p className="text-slate-500 font-mono">
                            Ref: {r.registrationReference} · {r.participationType}
                            {r.team?.teamName ? ` · Team: ${r.team.teamName}` : ''}
                          </p>
                        </div>
                        <StatusTag status={r.registrationStatus} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Issued Certificates */}
              {getStudentCertificates(inspectingStudent).length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-[#142D50] mb-2 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#F28C28]" />
                    <span>Issued Certificates ({getStudentCertificates(inspectingStudent).length})</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {getStudentCertificates(inspectingStudent).map((c) => (
                      <div
                        key={c.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <p className="font-semibold text-[#142D50]">{c.certificateTitle}</p>
                        <p className="text-slate-600">
                          {c.eventName} · {c.gameName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-500 mt-1">{c.id}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Timeline */}
              <div>
                <h3 className="text-sm font-bold text-[#142D50] mb-2 flex items-center gap-1.5">
                  <LogIn className="w-4 h-4 text-[#142D50]" />
                  <span>Complete User Activity Timeline ({inspectActivities.length})</span>
                </h3>
                {loadingInspectActivities ? (
                  <p className="text-xs text-slate-500 p-4">Loading user activity...</p>
                ) : inspectActivities.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    No activity recorded yet for this student.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-72 overflow-y-auto">
                    {inspectActivities.map((act) => {
                      const badge = ACTION_BADGE_MAP[act.action] || {
                        label: act.action,
                        className: 'bg-slate-100 text-slate-700 border-slate-200',
                      };
                      return (
                        <div key={act.id} className="p-3 bg-white flex items-start justify-between gap-3 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded border ${badge.className}`}
                              >
                                {badge.label}
                              </span>
                              <span className="font-medium text-slate-900">{act.summary}</span>
                            </div>
                            {act.path && (
                              <p className="font-mono text-[11px] text-slate-500">{act.path}</p>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                            {formatDateTime(act.createdAt)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {canModerate && (
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-end gap-2">
                {inspectingStudent.hasAccountDoc && (
                  <button
                    type="button"
                    onClick={() => {
                      setBlockTarget(inspectingStudent);
                      setBlockReason(inspectingStudent.blockedReason || '');
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg border ${
                      inspectingStudent.status === 'blocked'
                        ? 'text-emerald-800 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                        : 'text-amber-800 bg-amber-50 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    {inspectingStudent.status === 'blocked' ? 'Unblock Student' : 'Block Student'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setRemoveTarget(inspectingStudent);
                    setAlsoDeleteRegs(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Student</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Block / Unblock Confirmation Modal */}
      {blockTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setBlockTarget(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  blockTarget.status === 'blocked'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#142D50]">
                  {blockTarget.status === 'blocked' ? 'Unblock Student Account?' : 'Block Student Account?'}
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  {blockTarget.status === 'blocked'
                    ? `Restore access for ${blockTarget.displayName} (${blockTarget.email}) so they can update their profile and register for events.`
                    : `Blocking ${blockTarget.displayName} (${blockTarget.email}) immediately prevents them from registering for any event, saving profiles, or using the student portal.`}
                </p>
              </div>
            </div>

            {blockTarget.status !== 'blocked' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reason for Blocking (Shown to student)
                </label>
                <textarea
                  rows={3}
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g. Duplicate/fake registration details or unauthorized activity without permission."
                  className={`${inputClass} w-full`}
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingBlock}
                onClick={() => void handleConfirmBlockToggle()}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg disabled:opacity-60 ${
                  blockTarget.status === 'blocked'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : 'bg-red-700 hover:bg-red-800'
                }`}
              >
                {savingBlock
                  ? 'Saving...'
                  : blockTarget.status === 'blocked'
                  ? 'Confirm Unblock'
                  : 'Confirm Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Confirmation Modal */}
      {removeTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          onClick={() => setRemoveTarget(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-[#142D50]">
                  Remove Student from Database?
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  This deletes the Google login record, saved profile, and activity logs for{' '}
                  <strong>{removeTarget.displayName}</strong> ({removeTarget.email}). (Note: to keep
                  them permanently locked out from logging in again, use <strong>Block</strong>{' '}
                  instead.)
                </p>
              </div>
            </div>

            {getStudentRegistrations(removeTarget).length > 0 && (
              <label className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg cursor-pointer text-xs text-red-900">
                <input
                  type="checkbox"
                  checked={alsoDeleteRegs}
                  onChange={(e) => setAlsoDeleteRegs(e.target.checked)}
                  className="mt-0.5 accent-red-600"
                />
                <span>
                  Also delete this student&apos;s{' '}
                  <strong>{getStudentRegistrations(removeTarget).length}</strong> event
                  registration(s) and duplicate locks
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRemoveTarget(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removing}
                onClick={() => void handleConfirmRemove()}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-60"
              >
                {removing ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

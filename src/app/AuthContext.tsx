import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/src/services/firebase/config';
import {
  resolveAdminProfile,
  signInWithGoogle,
  signOutAdmin,
} from '@/src/services/firebase/auth';
import {
  ensureEnrollmentLockForProfile,
  getStudentAccount,
  getStudentProfile,
  logStudentActivity,
  syncStudentAccountOnLogin,
} from '@/src/services/firebase/students';
import type { AdminUser, StudentAccount, StudentProfile } from '@/src/types/models';

interface AuthContextValue {
  firebaseUser: User | null;
  adminProfile: AdminUser | null;
  studentProfile: StudentProfile | null;
  studentAccount: StudentAccount | null;
  isStudentBlocked: boolean;
  loading: boolean;
  authError: string | null;
  loginWithGoogle: () => Promise<AdminUser | null>;
  loginStudentWithGoogle: () => Promise<{ user: User; profile: StudentProfile | null } | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshStudentProfile: () => Promise<StudentProfile | null>;
  setStudentProfileState: (profile: StudentProfile | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const SESSION_LOGIN_KEY = (uid: string) => `gec_student_session_logged_${uid}`;
const SESSION_BLOCK_LOG_KEY = (uid: string) => `gec_student_block_logged_${uid}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminUser | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [studentAccount, setStudentAccount] = useState<StudentAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const isStudentBlocked = Boolean(
    studentAccount && studentAccount.status === 'blocked' && !adminProfile
  );

  const loadSessionProfiles = useCallback(async (user: User | null) => {
    if (!user) {
      setAdminProfile(null);
      setStudentProfile(null);
      setStudentAccount(null);
      setLoading(false);
      return;
    }
    try {
      setAuthError(null);
      const [admProfile, stuProfile, existingAcct] = await Promise.all([
        resolveAdminProfile(user).catch(() => null),
        getStudentProfile(user.uid).catch(() => null),
        getStudentAccount(user.uid).catch(() => null),
      ]);
      setAdminProfile(admProfile);
      setStudentProfile(stuProfile);

      let resolvedAcct = existingAcct;

      // Track non-admin Google sessions automatically in studentAccounts & studentActivity
      if (!admProfile && user.email && user.emailVerified) {
        if (stuProfile) {
          void ensureEnrollmentLockForProfile(stuProfile);
        }
        const sessionKey = SESSION_LOGIN_KEY(user.uid);
        const alreadyCountedThisSession = sessionStorage.getItem(sessionKey) === '1';

        if (!existingAcct || existingAcct.status === 'active') {
          const synced = await syncStudentAccountOnLogin({
            user,
            profile: stuProfile,
            incrementLogin: Boolean(existingAcct && !alreadyCountedThisSession),
          }).catch(() => existingAcct);
          if (synced) resolvedAcct = synced;

          if (!alreadyCountedThisSession && synced?.status !== 'blocked') {
            sessionStorage.setItem(sessionKey, '1');
            await logStudentActivity({
              uid: user.uid,
              email: user.email,
              studentName: stuProfile?.fullName || user.displayName || '',
              registrationNumber: stuProfile?.registrationNumber || '',
              action: 'login',
              summary: 'Signed in with Google on GEC Khagaria Sports Club',
              path: window.location.pathname,
            });
          }
        }

        if (resolvedAcct?.status === 'blocked') {
          setAuthError(
            `Your student account has been blocked by the Sports Club Administrator${
              resolvedAcct.blockedReason ? `: ${resolvedAcct.blockedReason}` : '.'
            }`
          );
          const blockKey = SESSION_BLOCK_LOG_KEY(user.uid);
          if (sessionStorage.getItem(blockKey) !== '1') {
            sessionStorage.setItem(blockKey, '1');
            await logStudentActivity({
              uid: user.uid,
              email: user.email,
              studentName: resolvedAcct.fullName || resolvedAcct.displayName || user.displayName || '',
              registrationNumber: resolvedAcct.registrationNumber || '',
              action: 'blocked_access_attempt',
              summary: `Blocked student attempted to access ${window.location.pathname}`,
              path: window.location.pathname,
            });
          }
        }
      }

      setStudentAccount(resolvedAcct);
    } catch {
      setAdminProfile(null);
      setStudentProfile(null);
      setStudentAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      void loadSessionProfiles(user);
    });
    return () => unsub();
  }, [loadSessionProfiles]);

  const loginWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      setFirebaseUser(user);
      const [profile, stuProfile, stuAcct] = await Promise.all([
        resolveAdminProfile(user),
        getStudentProfile(user.uid).catch(() => null),
        getStudentAccount(user.uid).catch(() => null),
      ]);
      setAdminProfile(profile);
      setStudentProfile(stuProfile);
      setStudentAccount(stuAcct);
      if (!profile) {
        setAuthError(
          `Signed in as ${user.email}, which does not have an active administrator invitation.`
        );
      }
      return profile;
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loginStudentWithGoogle = async () => {
    setAuthError(null);
    try {
      const user = await signInWithGoogle();
      setFirebaseUser(user);
      const [admProfile, stuProfile, existingAcct] = await Promise.all([
        resolveAdminProfile(user).catch(() => null),
        getStudentProfile(user.uid).catch(() => null),
        getStudentAccount(user.uid).catch(() => null),
      ]);
      setAdminProfile(admProfile);
      setStudentProfile(stuProfile);

      let syncedAcct = existingAcct;
      if (user.email && user.emailVerified) {
        if (stuProfile && !admProfile) {
          void ensureEnrollmentLockForProfile(stuProfile);
        }
        if (!existingAcct || existingAcct.status === 'active') {
          const updated = await syncStudentAccountOnLogin({
            user,
            profile: stuProfile,
            incrementLogin: Boolean(existingAcct),
          }).catch(() => existingAcct);
          if (updated) syncedAcct = updated;

          sessionStorage.setItem(SESSION_LOGIN_KEY(user.uid), '1');
          await logStudentActivity({
            uid: user.uid,
            email: user.email,
            studentName: stuProfile?.fullName || user.displayName || '',
            registrationNumber: stuProfile?.registrationNumber || '',
            action: 'login',
            summary: 'Signed in via Google Student Login',
            path: window.location.pathname,
          });
        }

        if (syncedAcct?.status === 'blocked' && !admProfile) {
          setAuthError(
            `Your student account has been blocked by the Sports Club Administrator${
              syncedAcct.blockedReason ? `: ${syncedAcct.blockedReason}` : '.'
            }`
          );
          await logStudentActivity({
            uid: user.uid,
            email: user.email,
            studentName: syncedAcct.fullName || syncedAcct.displayName || user.displayName || '',
            registrationNumber: syncedAcct.registrationNumber || '',
            action: 'blocked_access_attempt',
            summary: 'Blocked student attempted to sign in',
            path: window.location.pathname,
          });
        }
      }

      setStudentAccount(syncedAcct);
      return { user, profile: stuProfile };
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Student Google Sign-In failed.');
      return null;
    }
  };

  const logout = async () => {
    const currentUser = firebaseUser;
    const currentProfile = studentProfile;
    const currentAcct = studentAccount;
    const isAdminSession = Boolean(adminProfile);

    if (currentUser?.email) {
      sessionStorage.removeItem(SESSION_LOGIN_KEY(currentUser.uid));
      sessionStorage.removeItem(SESSION_BLOCK_LOG_KEY(currentUser.uid));
      if (!isAdminSession && currentAcct?.status !== 'blocked') {
        await logStudentActivity({
          uid: currentUser.uid,
          email: currentUser.email,
          studentName: currentProfile?.fullName || currentUser.displayName || '',
          registrationNumber: currentProfile?.registrationNumber || '',
          action: 'logout',
          summary: 'Signed out from student account',
          path: window.location.pathname,
        });
      }
    }

    await signOutAdmin();
    setFirebaseUser(null);
    setAdminProfile(null);
    setStudentProfile(null);
    setStudentAccount(null);
    setAuthError(null);
  };

  const refreshProfile = async () => {
    if (firebaseUser) {
      await loadSessionProfiles(firebaseUser);
    }
  };

  const refreshStudentProfile = async (): Promise<StudentProfile | null> => {
    if (!firebaseUser) return null;
    const [stuProfile, stuAcct] = await Promise.all([
      getStudentProfile(firebaseUser.uid).catch(() => null),
      getStudentAccount(firebaseUser.uid).catch(() => null),
    ]);
    setStudentProfile(stuProfile);
    if (stuAcct) setStudentAccount(stuAcct);
    return stuProfile;
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        adminProfile,
        studentProfile,
        studentAccount,
        isStudentBlocked,
        loading,
        authError,
        loginWithGoogle,
        loginStudentWithGoogle,
        logout,
        refreshProfile,
        refreshStudentProfile,
        setStudentProfileState: setStudentProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

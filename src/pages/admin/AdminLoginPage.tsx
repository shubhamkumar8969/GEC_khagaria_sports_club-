import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/src/app/AuthContext';

export function AdminLoginPage() {
  const { adminProfile, firebaseUser, loading, authError, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (adminProfile) {
      navigate('/admin/dashboard', { replace: true });
    }
  }, [adminProfile, navigate]);

  return (
    <div className="min-h-screen bg-hero-arena flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full card-3d rounded-2xl p-8 space-y-6">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-300 hover:text-white mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Sports Club Home</span>
          </Link>

          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/images__1__72d91f3a.jpeg"
              alt="GEC Khagaria logo"
              className="w-11 h-11 rounded-full object-contain bg-white border border-red-400/60 p-0.5 shrink-0"
            />
            <div>
              <h1 className="font-display text-xl font-bold text-white">
                Administrator Sign In
              </h1>
              <p className="text-xs text-blue-300">
                GEC Khagaria Sports Club Management Console
              </p>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          Access is restricted to invited Sports Club administrators and coordinators. Sign in with
          your authorized Google account to continue.
        </p>

        {authError && (
          <div className="p-4 bg-red-950/70 border border-red-500/40 rounded-xl text-xs text-red-200 space-y-2">
            <p className="font-semibold text-white">Access Denied</p>
            <p>{authError}</p>
            {firebaseUser && (
              <button
                type="button"
                onClick={() => void logout()}
                className="underline font-semibold text-red-200 hover:text-white"
              >
                Sign out ({firebaseUser.email}) and try another account
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => void loginWithGoogle()}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold rounded-xl btn-3d-mix disabled:opacity-60"
        >
          <span>{loading ? 'Verifying session...' : 'Sign in with Google'}</span>
        </button>

        <p className="text-xs text-slate-400 text-center">
          No public admin registration is permitted. Contact the Super Admin for role invites.
        </p>
      </div>
    </div>
  );
}

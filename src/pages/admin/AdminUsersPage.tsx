import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { useAuth } from '@/src/app/AuthContext';
import {
  createOrUpdateInvite,
  deleteAdminInvite,
  listAdminInvites,
  listAdmins,
  updateAdminUser,
} from '@/src/services/firebase/admins';
import { listAllEventsForAdmin } from '@/src/services/firebase/events';
import type { AdminInvite, AdminRole, AdminUser, SportEvent } from '@/src/types/models';

export function AdminUsersPage() {
  const { adminProfile } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Invite Form
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<AdminRole>('event_admin');
  const [assignedEventIds, setAssignedEventIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!adminProfile) return;
    setLoading(true);
    try {
      const [admList, invList, evtList] = await Promise.all([
        listAdmins(),
        listAdminInvites(),
        listAllEventsForAdmin(adminProfile),
      ]);
      setAdmins(admList);
      setInvites(invList);
      setEvents(evtList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load admin accounts.');
    } finally {
      setLoading(false);
    }
  }, [adminProfile]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleEventAssignment = (eventId: string) => {
    setAssignedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminProfile || !email.trim() || !displayName.trim()) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await createOrUpdateInvite(
        {
          email,
          displayName,
          role,
          assignedEventIds: role === 'super_admin' ? [] : assignedEventIds,
          permissions: role === 'super_admin' ? ['all'] : ['manage_assigned_events'],
          active: true,
        },
        adminProfile
      );
      setNotice(
        `Authorized ${email.trim().toLowerCase()} as ${role.replace('_', ' ')}. They can now sign in with Google on /admin/login.`
      );
      setEmail('');
      setDisplayName('');
      setAssignedEventIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create admin invite.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (target: AdminUser) => {
    if (!adminProfile || target.uid === adminProfile.uid) return;
    try {
      await updateAdminUser(
        target,
        {
          displayName: target.displayName,
          role: target.role,
          active: !target.active,
          assignedEventIds: target.assignedEventIds,
          permissions: target.permissions,
        },
        adminProfile
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update admin status.');
    }
  };

  const handleRoleChange = async (target: AdminUser, nextRole: AdminRole) => {
    if (!adminProfile || target.uid === adminProfile.uid) return;
    try {
      await updateAdminUser(
        target,
        {
          displayName: target.displayName,
          role: nextRole,
          active: target.active,
          assignedEventIds: target.assignedEventIds,
          permissions: target.permissions,
        },
        adminProfile
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change admin role.');
    }
  };

  const handleToggleAdminEvent = async (target: AdminUser, eventId: string) => {
    if (!adminProfile) return;
    const nextEvents = target.assignedEventIds.includes(eventId)
      ? target.assignedEventIds.filter((id) => id !== eventId)
      : [...target.assignedEventIds, eventId];
    try {
      await updateAdminUser(
        target,
        {
          displayName: target.displayName,
          role: target.role,
          active: target.active,
          assignedEventIds: nextEvents,
          permissions: target.permissions,
        },
        adminProfile
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update event assignments.');
    }
  };

  const handleRevokeInvite = async (inv: AdminInvite) => {
    if (!adminProfile) return;
    try {
      await deleteAdminInvite(inv, adminProfile);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to revoke invite.');
    }
  };

  return (
    <AdminLayout
      title="Admin Users & Access Control"
      breadcrumb="Admin / Admins"
      requireSuperAdmin
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form
          onSubmit={(e) => void handleInvite(e)}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 h-fit"
        >
          <h2 className="font-display text-lg font-bold text-[#142D50]">
            Invite Administrator
          </h2>
          <p className="text-xs text-slate-600">
            Pre-authorize a Google account email to activate an admin or coordinator profile.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 text-xs">
              {error}
            </div>
          )}
          {notice && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-3 text-xs">
              {notice}
            </div>
          )}

          <div>
            <label htmlFor="inv-name" className="block text-xs font-medium text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              id="inv-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Dr. Rajesh Singh"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="inv-email" className="block text-xs font-medium text-slate-700 mb-1">
              Google Account Email *
            </label>
            <input
              id="inv-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="faculty@gmail.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="inv-role" className="block text-xs font-medium text-slate-700 mb-1">
              Role
            </label>
            <select
              id="inv-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AdminRole)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="event_admin">Event Admin (Assigned events only)</option>
              <option value="coordinator">Coordinator / Volunteer (Assigned events, masked PII)</option>
              <option value="super_admin">Super Admin (Full access)</option>
            </select>
          </div>

          {role !== 'super_admin' && (
            <div>
              <p className="text-xs font-medium text-slate-700 mb-1.5">Assigned Events</p>
              {events.length === 0 ? (
                <p className="text-xs text-slate-500">Create events first to assign them.</p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto p-2 bg-[#F4F6F8] rounded-lg border border-slate-200">
                  {events.map((evt) => (
                    <label
                      key={evt.id}
                      className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={assignedEventIds.includes(evt.id)}
                        onChange={() => toggleEventAssignment(evt.id)}
                      />
                      <span>{evt.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-60"
          >
            <UserPlus className="w-4 h-4" />
            <span>{submitting ? 'Issuing Invite...' : 'Issue Admin Invite'}</span>
          </button>
        </form>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-display text-base font-bold text-[#142D50]">
                Active & Deactivated Administrators ({admins.length})
              </h2>
            </div>
            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading admins...</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {admins.map((adm) => {
                  const isSelf = adm.uid === adminProfile?.uid;
                  return (
                    <div key={adm.uid} className="p-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sm text-[#142D50]">
                            {adm.displayName} {isSelf && '(You)'}
                          </p>
                          <p className="text-xs text-slate-500">{adm.email}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            disabled={isSelf}
                            value={adm.role}
                            onChange={(e) =>
                              void handleRoleChange(adm, e.target.value as AdminRole)
                            }
                            className="text-xs border border-slate-300 rounded-md px-2 py-1 bg-white text-slate-900 disabled:opacity-60"
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="event_admin">Event Admin</option>
                            <option value="coordinator">Coordinator</option>
                          </select>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => void handleToggleActive(adm)}
                            className={`px-3 py-1 text-xs font-medium rounded-md border disabled:opacity-40 ${
                              adm.active
                                ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
                                : 'text-red-800 bg-red-50 border-red-200'
                            }`}
                          >
                            {adm.active ? 'Active' : 'Deactivated'}
                          </button>
                        </div>
                      </div>

                      {adm.role !== 'super_admin' && events.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-medium text-slate-500">
                            Assigned Events:
                          </span>
                          {events.map((evt) => {
                            const assigned = adm.assignedEventIds.includes(evt.id);
                            return (
                              <button
                                key={evt.id}
                                type="button"
                                onClick={() => void handleToggleAdminEvent(adm, evt.id)}
                                className={`px-2 py-0.5 text-[11px] rounded border ${
                                  assigned
                                    ? 'bg-[#142D50] text-white border-[#142D50]'
                                    : 'bg-white text-slate-600 border-slate-300'
                                }`}
                              >
                                {evt.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-display text-base font-bold text-[#142D50]">
                Issued Email Invites ({invites.length})
              </h2>
            </div>
            {invites.length === 0 ? (
              <div className="p-6 text-sm text-slate-500 text-center">No pending invites.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {invites.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-4 flex items-center justify-between gap-4 text-sm"
                  >
                    <div>
                      <p className="font-medium text-[#142D50]">
                        {inv.displayName} ({inv.email})
                      </p>
                      <p className="text-xs text-slate-500">
                        Role: {inv.role.replace('_', ' ')} · Assigned events:{' '}
                        {inv.assignedEventIds.length}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRevokeInvite(inv)}
                      className="p-1.5 text-red-600 hover:text-red-800"
                      title="Revoke invite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}

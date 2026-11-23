import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, Eye, Printer, Trophy, Unlock } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { StatusTag, getStatusLabel } from '@/src/components/common/StatusBadge';
import { ConfirmModal } from '@/src/components/common/ConfirmModal';
import { CertificateModal } from '@/src/components/common/CertificateModal';
import { useAuth } from '@/src/app/AuthContext';
import { useSiteSettings } from '@/src/app/SettingsContext';
import { getGameById } from '@/src/services/firebase/events';
import {
  getRegistrationById,
  getRegistrationStatusHistory,
  issueOrUpdateCertificate,
  releaseDuplicateLock,
  updateRegistrationDetails,
} from '@/src/services/firebase/registrations';
import { promoteRegistrationToResult } from '@/src/services/firebase/results';
import { generateCertificateId, maskEmail, maskPhone } from '@/src/schemas/validation';
import { formatDateTime } from '@/src/utils/formatters';
import type { CertificateData } from '@/src/utils/certificateGenerator';
import type {
  EventGame,
  MatchResult,
  MatchStatus,
  Registration,
  RegistrationStatus,
  ResultPlacement,
  SelectionStatus,
  StatusHistoryEntry,
} from '@/src/types/models';

export function AdminRegistrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { adminProfile } = useAuth();
  const { settings } = useSiteSettings();

  const [reg, setReg] = useState<Registration | null>(null);
  const [game, setGame] = useState<EventGame | null>(null);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>('approved');
  const [selectionStatus, setSelectionStatus] = useState<SelectionStatus>('not_reviewed');
  const [teamAssignment, setTeamAssignment] = useState('');
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('not_scheduled');
  const [result, setResult] = useState<MatchResult>('no_result');
  const [adminNotes, setAdminNotes] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [lockModalOpen, setLockModalOpen] = useState(false);

  // Certificate Management State
  const [certTitle, setCertTitle] = useState('');
  const [certNote, setCertNote] = useState('');
  const [savingCert, setSavingCert] = useState(false);
  const [previewCertOpen, setPreviewCertOpen] = useState(false);
  const [promotingResult, setPromotingResult] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [regDoc, histList] = await Promise.all([
        getRegistrationById(id),
        getRegistrationStatusHistory(id),
      ]);
      setReg(regDoc);
      setHistory(histList);
      if (regDoc) {
        setRegistrationStatus(regDoc.registrationStatus);
        setSelectionStatus(regDoc.selectionStatus);
        setTeamAssignment(regDoc.teamAssignment);
        setMatchStatus(regDoc.matchStatus);
        setResult(regDoc.result);
        setAdminNotes(regDoc.adminNotes);
        const autoTitle =
          regDoc.result === 'winner'
            ? 'Certificate of Excellence — Winner'
            : regDoc.result === 'runner_up'
            ? 'Certificate of Merit — Runner-Up'
            : 'Certificate of Participation';
        setCertTitle(regDoc.certificateTitle || autoTitle);
        setCertNote(regDoc.certificateNote || '');
        const gm = await getGameById(regDoc.eventId, regDoc.gameId);
        setGame(gm);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load registration record.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const canModifyRegStatus =
    adminProfile?.role === 'super_admin' || adminProfile?.role === 'event_admin';
  const showFullPII =
    adminProfile?.role === 'super_admin' || adminProfile?.role === 'event_admin';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reg || !adminProfile) return;
    setSaving(true);
    setError(null);
    setSavedNotice(null);
    try {
      await updateRegistrationDetails(
        reg,
        {
          ...(canModifyRegStatus ? { registrationStatus } : {}),
          selectionStatus,
          teamAssignment,
          matchStatus,
          result,
          adminNotes,
        },
        reason,
        adminProfile
      );
      setReason('');
      setSavedNotice('Registration status and competition progress saved.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update registration.');
    } finally {
      setSaving(false);
    }
  };

  const handleReleaseLock = async () => {
    if (!reg || !adminProfile) return;
    try {
      await releaseDuplicateLock(reg, adminProfile);
      setLockModalOpen(false);
      setSavedNotice(
        `Duplicate lock released for ${reg.participant.enrollmentNumber}. They can submit a new registration if needed.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to release lock.');
    }
  };

  const handleCertificateUpdate = async (issued: boolean) => {
    if (!reg || !adminProfile) return;
    setSavingCert(true);
    setError(null);
    setSavedNotice(null);
    try {
      const certId = await issueOrUpdateCertificate(
        reg,
        {
          issued,
          certificateTitle: certTitle,
          certificateNote: certNote,
        },
        adminProfile
      );
      setSavedNotice(
        issued
          ? `Official certificate (${certId}) issued and unlocked in the Student Sports Portal.`
          : 'Certificate revoked from public download.'
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update certificate status.');
    } finally {
      setSavingCert(false);
    }
  };

  const handlePromoteToResultsPanel = async () => {
    if (!reg || !adminProfile) return;
    setPromotingResult(true);
    setError(null);
    setSavedNotice(null);
    try {
      const mappedPlacement: ResultPlacement =
        result === 'winner'
          ? 'winner'
          : result === 'runner_up'
          ? 'runner_up'
          : 'participant';
      await promoteRegistrationToResult(
        reg,
        game?.category || 'Outdoor',
        mappedPlacement,
        teamAssignment ? `Pool / Team: ${teamAssignment}` : '',
        true,
        adminProfile
      );
      setSavedNotice(
        `Published "${reg.team?.teamName || reg.participant.fullName}" to the public Results Panel.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to publish to Results Panel.');
    } finally {
      setPromotingResult(false);
    }
  };

  const certPreviewData: CertificateData | null = reg
    ? {
        certificateId: reg.certificateId || generateCertificateId(reg.registrationReference),
        certificateTitle: certTitle.trim() || 'Certificate of Participation',
        certificateNote: certNote.trim(),
        participantName: reg.participant.fullName,
        enrollmentNumber: reg.participant.enrollmentNumber,
        branch: reg.participant.branch,
        year: reg.participant.year,
        teamName: reg.team?.teamName,
        eventName: reg.eventName,
        gameName: reg.gameName,
        registrationReference: reg.registrationReference,
        resultLabel: getStatusLabel(result),
        issuedAtText: reg.certificateIssuedAt
          ? formatDateTime(reg.certificateIssuedAt).split(',')[0]
          : formatDateTime(reg.updatedAt).split(',')[0],
        settings,
      }
    : null;

  return (
    <AdminLayout
      title={reg ? `${reg.participant.fullName} (${reg.registrationReference})` : 'Registration Detail'}
      breadcrumb="Admin / Participants / Detail"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 no-print">
          <Link
            to="/admin/participants"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#142D50]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Participants</span>
          </Link>

          <div className="flex items-center gap-3">
            {canModifyRegStatus && reg && (
              <button
                type="button"
                onClick={() => setLockModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Release Duplicate Lock</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Record</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}
        {savedNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm">
            {savedNotice}
          </div>
        )}

        {loading ? (
          <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : !reg ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            Registration record not found.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Participant, Custom Answers, Team Roster, Status History */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{reg.registrationReference}</p>
                    <h2 className="mt-1 font-display text-2xl font-bold text-[#142D50]">
                      {reg.participant.fullName}
                    </h2>
                    <p className="text-sm text-slate-600">
                      {reg.eventName} · {reg.gameName} ({reg.participationType})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusTag status={reg.registrationStatus} />
                    <StatusTag status={reg.selectionStatus} />
                    <StatusTag status={reg.matchStatus} />
                  </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Enrollment Number</dt>
                    <dd className="font-mono font-semibold text-[#142D50]">
                      {reg.participant.enrollmentNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Branch & Year</dt>
                    <dd className="font-medium text-slate-800">
                      {reg.participant.branch} · {reg.participant.year}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Phone</dt>
                    <dd className="font-mono text-slate-800">
                      {showFullPII ? reg.participant.phone : maskPhone(reg.participant.phone)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Email</dt>
                    <dd className="text-slate-800">
                      {reg.participant.email
                        ? showFullPII
                          ? reg.participant.email
                          : maskEmail(reg.participant.email)
                        : 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Submitted Timestamp</dt>
                    <dd className="tabular-nums text-slate-700">{formatDateTime(reg.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Last Updated</dt>
                    <dd className="tabular-nums text-slate-700">{formatDateTime(reg.updatedAt)}</dd>
                  </div>
                </dl>
              </div>

              {/* Team Members Roster */}
              {reg.participationType !== 'individual' && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-[#142D50]">
                      {reg.team.teamName || 'Team / Pair Roster'} ({reg.team.members.length} extra member{reg.team.members.length === 1 ? '' : 's'})
                    </h3>
                  </div>

                  {reg.team.members.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Only team leader registered so far (teammate rows were left optional).
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                            <th className="py-2.5 px-3">#</th>
                            <th className="py-2.5 px-3">Member Name</th>
                            <th className="py-2.5 px-3">Registration No.</th>
                            <th className="py-2.5 px-3">Branch</th>
                            <th className="py-2.5 px-3">Year</th>
                            <th className="py-2.5 px-3">Role</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {reg.team.members.map((m, idx) => (
                            <tr key={idx}>
                              <td className="py-2.5 px-3 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-3 font-medium text-[#142D50]">
                                {m.fullName || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-mono">{m.enrollmentNumber || '—'}</td>
                              <td className="py-2.5 px-3">{m.branch || '—'}</td>
                              <td className="py-2.5 px-3">{m.year || '—'}</td>
                              <td className="py-2.5 px-3 text-slate-500">{m.roleLabel || 'Player'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Form Answers */}
              {Object.keys(reg.customAnswers || {}).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h3 className="font-display text-lg font-bold text-[#142D50]">
                    Game-Specific Answers
                  </h3>
                  <dl className="divide-y divide-slate-100 text-sm">
                    {Object.entries(reg.customAnswers).map(([fieldId, val]) => {
                      const def = game?.customFields?.find((f) => f.id === fieldId);
                      const formatted = Array.isArray(val) ? val.join(', ') : String(val ?? '—');
                      return (
                        <div key={fieldId} className="py-3 flex flex-col sm:flex-row sm:justify-between gap-1">
                          <dt className="text-slate-500">{def?.label || fieldId}</dt>
                          <dd className="font-medium text-[#142D50]">{formatted || '—'}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              )}

              {/* Status History */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <h3 className="font-display text-lg font-bold text-[#142D50]">Status History</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500">No status changes recorded yet.</p>
                ) : (
                  <div className="divide-y divide-slate-100 text-xs">
                    {history.map((h) => (
                      <div key={h.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-[#142D50]">
                            {h.field}: <span className="font-mono text-slate-500">{h.oldValue}</span>{' '}
                            → <span className="font-mono text-[#F28C28]">{h.newValue}</span>
                          </p>
                          {h.reason && <p className="mt-0.5 text-slate-600">Note: {h.reason}</p>}
                        </div>
                        <div className="text-slate-500 tabular-nums sm:text-right">
                          <p>{h.changedByName}</p>
                          <p>{formatDateTime(h.changedAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Review Controls + Certificate & Results Issuance */}
            <div className="space-y-6 no-print">
              <form
                onSubmit={(e) => void handleSave(e)}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
              >
                <h3 className="font-display text-lg font-bold text-[#142D50]">
                  Participation &amp; Match Controls
                </h3>

                {canModifyRegStatus && (
                  <div>
                    <label
                      htmlFor="reg-status-sel"
                      className="block text-xs font-semibold text-slate-800 mb-1"
                    >
                      Participation Status (Auto-Confirmed by Default)
                    </label>
                    <select
                      id="reg-status-sel"
                      value={registrationStatus}
                      onChange={(e) => setRegistrationStatus(e.target.value as RegistrationStatus)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
                    >
                      <option value="approved">Confirmed / Participating</option>
                      <option value="pending">Pending</option>
                      <option value="waitlisted">Waitlisted</option>
                      <option value="rejected">Cancelled / Ineligible</option>
                      <option value="withdrawn">Withdrawn</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-100 space-y-4">
                  <p className="text-xs font-semibold text-slate-600">
                    Match Progress &amp; Result
                  </p>

                  <div>
                    <label
                      htmlFor="sel-status"
                      className="block text-xs font-semibold text-slate-800 mb-1"
                    >
                      Team / Squad Selection
                    </label>
                    <select
                      id="sel-status"
                      value={selectionStatus}
                      onChange={(e) => setSelectionStatus(e.target.value as SelectionStatus)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
                    >
                      <option value="not_reviewed">Standard Entry</option>
                      <option value="shortlisted">Shortlisted</option>
                      <option value="selected">Selected</option>
                      <option value="not_selected">Not Selected</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="team-assign"
                      className="block text-xs font-semibold text-slate-800 mb-1"
                    >
                      Pool / Group Assignment
                    </label>
                    <input
                      id="team-assign"
                      type="text"
                      value={teamAssignment}
                      onChange={(e) => setTeamAssignment(e.target.value)}
                      placeholder="e.g. Pool A / Group 2"
                      className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="match-status"
                      className="block text-xs font-semibold text-slate-800 mb-1"
                    >
                      Match Status
                    </label>
                    <select
                      id="match-status"
                      value={matchStatus}
                      onChange={(e) => setMatchStatus(e.target.value as MatchStatus)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
                    >
                      <option value="not_scheduled">Not Scheduled</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="did_not_attend">Did Not Attend</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="match-res" className="block text-xs font-semibold text-slate-800 mb-1">
                      Result
                    </label>
                    <select
                      id="match-res"
                      value={result}
                      onChange={(e) => setResult(e.target.value as MatchResult)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
                    >
                      <option value="no_result">No Result</option>
                      <option value="participant">Participant</option>
                      <option value="runner_up">Runner-Up</option>
                      <option value="winner">Winner</option>
                      <option value="disqualified">Disqualified</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div>
                    <label htmlFor="admin-notes" className="block text-xs font-semibold text-slate-800 mb-1">
                      Admin Notes (Internal)
                    </label>
                    <textarea
                      id="admin-notes"
                      rows={3}
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor="change-reason" className="block text-xs font-semibold text-slate-800 mb-1">
                      Note for History Log (Optional)
                    </label>
                    <input
                      id="change-reason"
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Optional note..."
                      className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-60"
                >
                  {saving ? 'Saving Changes...' : 'Save Match Progress'}
                </button>
              </form>

              {/* Official Certificate Issuance Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#F28C28]" />
                    <h3 className="font-display text-base font-bold text-[#142D50]">
                      Certificate Issuance
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${
                      reg.certificateIssued
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {reg.certificateIssued ? 'Issued' : 'Not Issued'}
                  </span>
                </div>

                {reg.certificateIssued && reg.certificateId && (
                  <p className="text-xs font-mono text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                    ID: {reg.certificateId}
                  </p>
                )}

                <div>
                  <label htmlFor="cert-title" className="block text-xs font-semibold text-slate-800 mb-1">
                    Certificate Heading
                  </label>
                  <input
                    id="cert-title"
                    type="text"
                    value={certTitle}
                    onChange={(e) => setCertTitle(e.target.value)}
                    placeholder="Certificate of Participation"
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="cert-note" className="block text-xs font-semibold text-slate-800 mb-1">
                    Custom Citation Note (Optional)
                  </label>
                  <textarea
                    id="cert-note"
                    rows={2}
                    value={certNote}
                    onChange={(e) => setCertNote(e.target.value)}
                    placeholder="Leave blank for automatic tournament wording..."
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingCert}
                    onClick={() => void handleCertificateUpdate(true)}
                    className="flex-1 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 disabled:opacity-60"
                  >
                    {savingCert
                      ? 'Processing...'
                      : reg.certificateIssued
                      ? 'Update Certificate'
                      : 'Issue Certificate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewCertOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-[#142D50] border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                </div>

                {reg.certificateIssued && (
                  <button
                    type="button"
                    disabled={savingCert}
                    onClick={() => void handleCertificateUpdate(false)}
                    className="w-full px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-60"
                  >
                    Revoke Certificate Download
                  </button>
                )}

                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={promotingResult}
                    onClick={() => void handlePromoteToResultsPanel()}
                    className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#142D50] bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-60"
                  >
                    <Trophy className="w-3.5 h-3.5 text-[#F28C28]" />
                    <span>
                      {promotingResult ? 'Publishing...' : 'Publish Entry to Public Results Panel'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={lockModalOpen}
        title="Release Duplicate Registration Lock"
        description={`Releasing the uniqueness lock allows enrollment number ${reg?.participant.enrollmentNumber} to register again for ${reg?.gameName}. Use this only after withdrawing/rejecting a duplicate entry.`}
        confirmLabel="Release Lock"
        onCancel={() => setLockModalOpen(false)}
        onConfirm={() => void handleReleaseLock()}
      />

      <CertificateModal
        open={previewCertOpen}
        data={certPreviewData}
        onClose={() => setPreviewCertOpen(false)}
      />
    </AdminLayout>
  );
}

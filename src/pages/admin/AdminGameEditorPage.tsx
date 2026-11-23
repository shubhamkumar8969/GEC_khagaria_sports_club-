import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { useAuth } from '@/src/app/AuthContext';
import {
  getEventById,
  getGameById,
  getGameCounterCount,
  saveGame,
} from '@/src/services/firebase/events';
import { gameFormSchema, generateId } from '@/src/schemas/validation';
import { toLocalDateTimeInputValue } from '@/src/utils/formatters';
import type {
  CustomFieldDefinition,
  CustomFieldType,
  GameCategory,
  GameRegistrationStatus,
  ParticipationType,
} from '@/src/types/models';

export function AdminGameEditorPage() {
  const { id: eventId, gameId } = useParams<{ id: string; gameId?: string }>();
  const isEditing = Boolean(gameId);
  const { adminProfile } = useAuth();
  const navigate = useNavigate();

  const [eventName, setEventName] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<GameCategory>('Outdoor');
  const [participationType, setParticipationType] = useState<ParticipationType>('team');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [maxTeams, setMaxTeams] = useState(16);
  const [minTeamSize, setMinTeamSize] = useState(6);
  const [maxTeamSize, setMaxTeamSize] = useState(12);
  const [registrationDeadline, setRegistrationDeadline] = useState(() =>
    toLocalDateTimeInputValue(null, 12)
  );
  const [registrationStatus, setRegistrationStatus] = useState<GameRegistrationStatus>('open');
  const [eligibility, setEligibility] = useState('Open to all regular students of GEC Khagaria');
  const [sortOrder, setSortOrder] = useState(1);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [existingEntriesCount, setExistingEntriesCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    async function load() {
      try {
        const evt = await getEventById(eventId!);
        if (evt && active) {
          setEventName(evt.name);
          if (!gameId) {
            setRegistrationDeadline(toLocalDateTimeInputValue(evt.registrationEndAt));
          }
        }
        if (gameId) {
          const [gm, count] = await Promise.all([
            getGameById(eventId!, gameId),
            getGameCounterCount(eventId!, gameId),
          ]);
          if (gm && active) {
            setName(gm.name);
            setCategory(gm.category);
            setParticipationType(gm.participationType);
            setDescription(gm.description);
            setRules(gm.rules);
            setMaxParticipants(gm.maxParticipants);
            setMaxTeams(gm.maxTeams);
            setMinTeamSize(gm.minTeamSize);
            setMaxTeamSize(gm.maxTeamSize);
            setRegistrationDeadline(toLocalDateTimeInputValue(gm.registrationDeadline));
            setRegistrationStatus(gm.registrationStatus);
            setEligibility(gm.eligibility);
            setSortOrder(gm.sortOrder);
            setCustomFields(gm.customFields);
            setExistingEntriesCount(count);
          }
        }
      } catch (err) {
        if (active) setSubmitError(err instanceof Error ? err.message : 'Unable to load game.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [eventId, gameId]);

  const handleAddField = () => {
    if (customFields.length >= 25) return;
    setCustomFields((prev) => [
      ...prev,
      {
        id: generateId('cf'),
        label: '',
        type: 'short_text',
        required: false,
        helpText: '',
        options: [],
        filterable: false,
        order: prev.length + 1,
      },
    ]);
  };

  const handleUpdateField = (idx: number, patch: Partial<CustomFieldDefinition>) => {
    setCustomFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };

  const handleMoveField = (idx: number, dir: -1 | 1) => {
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= customFields.length) return;
    setCustomFields((prev) => {
      const next = [...prev];
      const temp = next[idx];
      next[idx] = next[swapIdx];
      next[swapIdx] = temp;
      return next.map((f, i) => ({ ...f, order: i + 1 }));
    });
  };

  const handleRemoveField = (idx: number) => {
    setCustomFields((prev) =>
      prev.filter((_, i) => i !== idx).map((f, i) => ({ ...f, order: i + 1 }))
    );
  };

  const saveGameRecord = async (addAnother: boolean) => {
    if (!adminProfile || !eventId) return;
    setSubmitError(null);
    setSavedNotice(null);

    const effectiveMin =
      participationType === 'individual' ? 1 : participationType === 'doubles' ? 2 : minTeamSize;
    const effectiveMax =
      participationType === 'individual' ? 1 : participationType === 'doubles' ? 2 : maxTeamSize;

    const parsed = gameFormSchema.safeParse({
      name,
      category,
      participationType,
      description,
      rules,
      maxParticipants: Number(maxParticipants) || 0,
      maxTeams: Number(maxTeams) || 0,
      minTeamSize: Number(effectiveMin) || 1,
      maxTeamSize: Number(effectiveMax) || 1,
      registrationDeadline,
      registrationStatus,
      eligibility,
      sortOrder: Number(sortOrder) || 0,
    });

    if (!parsed.success) {
      const nextErrs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        nextErrs[String(issue.path[0] || 'form')] = issue.message;
      }
      setErrors(nextErrs);
      return;
    }

    for (const f of customFields) {
      if (!f.label.trim()) {
        setSubmitError('Every extra question must have a clear label.');
        return;
      }
      if (['dropdown', 'single_choice', 'checkboxes'].includes(f.type) && f.options.length === 0) {
        setSubmitError(`Question "${f.label}" requires at least one choice option.`);
        return;
      }
    }

    setErrors({});
    setSaving(true);
    try {
      await saveGame(
        {
          id: gameId,
          eventId,
          ...parsed.data,
          registrationDeadline: new Date(parsed.data.registrationDeadline),
          customFields: customFields.map((f, idx) => ({
            ...f,
            label: f.label.trim(),
            helpText: f.helpText.trim(),
            options: f.options.map((o) => o.trim()).filter(Boolean),
            order: idx + 1,
          })),
        },
        adminProfile
      );

      if (addAnother && !isEditing) {
        const addedName = parsed.data.name;
        setName('');
        setDescription('');
        setRules('');
        setCustomFields([]);
        setSortOrder((prev) => prev + 1);
        setSavedNotice(`Saved "${addedName}". You can now enter the next game for this event.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate(`/admin/events/${eventId}/games`);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unable to save game.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveGameRecord(false);
  };

  return (
    <AdminLayout
      title={isEditing ? `Edit Game: ${name || '...'}` : 'Add New Game'}
      breadcrumb={`Admin / ${eventName || 'Event'} / Game Editor`}
    >
      <div className="max-w-4xl space-y-6">
        <Link
          to={`/admin/events/${eventId}/games`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-[#142D50]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {eventName || 'Event'} Games</span>
        </Link>

        {loading ? (
          <div className="h-96 bg-white border border-slate-200 rounded-xl animate-pulse" />
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-8">
            {savedNotice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-sm">
                {savedNotice}
              </div>
            )}
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
                {submitError}
              </div>
            )}

            {/* Basic Game Settings */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
              <h2 className="font-display text-lg font-bold text-[#142D50]">
                Game Details &amp; Player Rules
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="gm-name" className="block text-xs font-semibold text-slate-800 mb-1">
                    Game Name *
                  </label>
                  <input
                    id="gm-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Cricket, Volleyball, Kabaddi, Chess"
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label htmlFor="gm-cat" className="block text-xs font-semibold text-slate-800 mb-1">
                    Sport Category
                  </label>
                  <select
                    id="gm-cat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GameCategory)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
                  >
                    <option value="Outdoor">Outdoor</option>
                    <option value="Indoor">Indoor</option>
                    <option value="Athletics">Athletics</option>
                    <option value="Esports">Esports</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="gm-type" className="block text-xs font-semibold text-slate-800 mb-1">
                    Game Format (Individual or Group)
                  </label>
                  <select
                    id="gm-type"
                    value={participationType}
                    onChange={(e) => setParticipationType(e.target.value as ParticipationType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
                  >
                    <option value="individual">Individual (1 Player)</option>
                    <option value="doubles">Doubles (2 Players)</option>
                    <option value="team">Group / Team Event</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="gm-status"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Game Registration Status
                  </label>
                  <select
                    id="gm-status"
                    value={registrationStatus}
                    onChange={(e) =>
                      setRegistrationStatus(e.target.value as GameRegistrationStatus)
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-900"
                  >
                    <option value="draft">Draft (Hidden)</option>
                    <option value="open">Open for Registration</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="gm-deadline"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Registration Closing Date &amp; Time *
                  </label>
                  <input
                    id="gm-deadline"
                    type="datetime-local"
                    value={registrationDeadline}
                    onChange={(e) => setRegistrationDeadline(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Capacity & Team Size */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {participationType === 'individual' ? (
                  <div>
                    <label
                      htmlFor="gm-max-part"
                      className="block text-xs font-semibold text-slate-800 mb-1"
                    >
                      Max Players Allowed (0 = unlimited)
                    </label>
                    <input
                      id="gm-max-part"
                      type="number"
                      min={0}
                      value={maxParticipants}
                      onChange={(e) => setMaxParticipants(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="gm-max-teams"
                      className="block text-xs font-semibold text-slate-800 mb-1"
                    >
                      Max Teams Allowed (0 = unlimited)
                    </label>
                    <input
                      id="gm-max-teams"
                      type="number"
                      min={0}
                      value={maxTeams}
                      onChange={(e) => setMaxTeams(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-mono"
                    />
                  </div>
                )}

                {participationType === 'team' && (
                  <>
                    <div>
                      <label
                        htmlFor="gm-min-size"
                        className="block text-xs font-semibold text-slate-800 mb-1"
                      >
                        Minimum Players in Team
                      </label>
                      <input
                        id="gm-min-size"
                        type="number"
                        min={1}
                        max={30}
                        value={minTeamSize}
                        onChange={(e) => setMinTeamSize(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="gm-max-size"
                        className="block text-xs font-semibold text-slate-800 mb-1"
                      >
                        Maximum Players in Team
                      </label>
                      <input
                        id="gm-max-size"
                        type="number"
                        min={1}
                        max={30}
                        value={maxTeamSize}
                        onChange={(e) => setMaxTeamSize(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-mono"
                      />
                      {errors.maxTeamSize && (
                        <p className="mt-1 text-xs text-red-600">{errors.maxTeamSize}</p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="gm-order" className="block text-xs font-semibold text-slate-800 mb-1">
                    List Display Order
                  </label>
                  <input
                    id="gm-order"
                    type="number"
                    min={0}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="gm-desc" className="block text-xs font-semibold text-slate-800 mb-1">
                  Short Game Description
                </label>
                <textarea
                  id="gm-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe this game for students..."
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="gm-rules" className="block text-xs font-semibold text-slate-800 mb-1">
                  Match Rules &amp; Instructions
                </label>
                <textarea
                  id="gm-rules"
                  rows={3}
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  placeholder="Write tournament rules, match duration, or kit instructions..."
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="gm-elig" className="block text-xs font-semibold text-slate-800 mb-1">
                  Who Can Join (Eligibility)
                </label>
                <input
                  id="gm-elig"
                  type="text"
                  value={eligibility}
                  onChange={(e) => setEligibility(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Extra Custom Questions */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#142D50]">
                    Extra Custom Questions (Optional)
                  </h2>
                  <p className="text-xs text-slate-600">
                    Student Name, Registration Number, Phone, Branch, Year, and optional Team Members are
                    already included automatically. Add extra game-specific questions below if needed.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddField}
                  disabled={customFields.length >= 25}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Custom Question</span>
                </button>
              </div>

              {existingEntriesCount > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3 text-xs text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">
                      {existingEntriesCount} registration(s) already exist for this game.
                    </p>
                    <p className="mt-0.5">
                      Historical answers remain preserved under their stable field IDs, but avoid
                      removing active fields if coordinators rely on them.
                    </p>
                  </div>
                </div>
              )}

              {customFields.length === 0 ? (
                <div className="p-8 bg-[#F4F6F8] border border-slate-200 rounded-lg text-center text-sm text-slate-600">
                  No extra custom fields added. Only standard student & team fields will appear.
                </div>
              ) : (
                <div className="space-y-4">
                  {customFields.map((field, idx) => {
                    const needsOptions = ['dropdown', 'single_choice', 'checkboxes'].includes(
                      field.type
                    );
                    return (
                      <div
                        key={field.id}
                        className="p-4 bg-[#F4F6F8] border border-slate-200 rounded-lg space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono text-slate-500">
                            Question #{idx + 1} · ID: {field.id}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveField(idx, -1)}
                              className="p-1 text-slate-500 hover:text-[#142D50] disabled:opacity-30"
                              aria-label="Move field up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === customFields.length - 1}
                              onClick={() => handleMoveField(idx, 1)}
                              className="p-1 text-slate-500 hover:text-[#142D50] disabled:opacity-30"
                              aria-label="Move field down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveField(idx)}
                              className="p-1 text-red-600 hover:text-red-800"
                              aria-label="Remove field"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Question Label *
                            </label>
                            <input
                              type="text"
                              value={field.label}
                              onChange={(e) =>
                                handleUpdateField(idx, { label: e.target.value })
                              }
                              placeholder="e.g. Preferred Playing Position"
                              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Answer Format
                            </label>
                            <select
                              value={field.type}
                              onChange={(e) =>
                                handleUpdateField(idx, {
                                  type: e.target.value as CustomFieldType,
                                })
                              }
                              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 px-3 py-1.5 text-sm"
                            >
                              <option value="short_text">Short Text</option>
                              <option value="paragraph">Paragraph</option>
                              <option value="number">Number</option>
                              <option value="dropdown">Dropdown</option>
                              <option value="single_choice">Single Choice (Radio)</option>
                              <option value="checkboxes">Checkboxes (Multi)</option>
                              <option value="date">Date</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                              Hint Text (Optional)
                            </label>
                            <input
                              type="text"
                              value={field.helpText}
                              onChange={(e) =>
                                handleUpdateField(idx, { helpText: e.target.value })
                              }
                              placeholder="Hint shown under the question"
                              className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-1.5 text-sm"
                            />
                          </div>

                          {needsOptions && (
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                Choices (separate with commas) *
                              </label>
                              <input
                                type="text"
                                value={field.options.join(', ')}
                                onChange={(e) =>
                                  handleUpdateField(idx, {
                                    options: e.target.value.split(',').map((s) => s.trim()),
                                  })
                                }
                                placeholder="e.g. Batsman, Bowler, All-Rounder"
                                className="w-full rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 px-3 py-1.5 text-sm"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-6 pt-1">
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) =>
                                handleUpdateField(idx, { required: e.target.checked })
                              }
                            />
                            <span>Required field</span>
                          </label>
                          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={field.filterable}
                              onChange={(e) =>
                                handleUpdateField(idx, { filterable: e.target.checked })
                              }
                            />
                            <span>Allow filtering in Admin Participant Table</span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Link
                to={`/admin/events/${eventId}/games`}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </Link>
              {!isEditing && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveGameRecord(true)}
                  className="px-5 py-2.5 text-sm font-semibold text-[#142D50] bg-[#F28C28] rounded-lg hover:bg-[#f79d42] disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save & Add Another Game'}
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-[#142D50] rounded-lg hover:bg-[#1c3e6e] disabled:opacity-60"
              >
                {saving ? 'Saving...' : isEditing ? 'Save Game Changes' : 'Save Game'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AdminLayout>
  );
}

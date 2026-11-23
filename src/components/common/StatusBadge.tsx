import type {
  EventStatus,
  GameRegistrationStatus,
  MatchResult,
  MatchStatus,
  RegistrationStatus,
  SelectionStatus,
} from '@/src/types/models';

const LABELS: Record<string, { label: string; classes: string }> = {
  // Event Status
  draft: { label: 'Draft', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  published: {
    label: 'Live · Published',
    classes: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  registration_open: {
    label: 'Live · Registration Open',
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  },
  registration_closed: {
    label: 'Registration Closed',
    classes: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  ongoing: {
    label: 'Live · Ongoing',
    classes: 'bg-indigo-50 text-indigo-800 border-indigo-300',
  },
  completed: { label: 'Completed', classes: 'bg-slate-100 text-slate-700 border-slate-200' },
  archived: { label: 'Archived', classes: 'bg-slate-100 text-slate-500 border-slate-200' },

  // Game Status
  open: { label: 'Open', classes: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  closed: { label: 'Closed', classes: 'bg-rose-50 text-rose-800 border-rose-200' },

  // Registration Status
  pending: { label: 'Pending Review', classes: 'bg-amber-50 text-amber-800 border-amber-300' },
  approved: { label: 'Approved', classes: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  rejected: { label: 'Rejected', classes: 'bg-rose-50 text-rose-800 border-rose-200' },
  waitlisted: { label: 'Waitlisted', classes: 'bg-orange-50 text-orange-800 border-orange-300' },
  withdrawn: { label: 'Withdrawn', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  cancelled: { label: 'Cancelled', classes: 'bg-rose-50 text-rose-700 border-rose-200' },

  // Competition Progress
  not_reviewed: { label: 'Not Reviewed', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  shortlisted: { label: 'Shortlisted', classes: 'bg-sky-50 text-sky-800 border-sky-200' },
  selected: { label: 'Selected', classes: 'bg-emerald-50 text-emerald-800 border-emerald-300' },
  not_selected: { label: 'Not Selected', classes: 'bg-slate-100 text-slate-600 border-slate-200' },

  not_scheduled: { label: 'Not Scheduled', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  scheduled: { label: 'Scheduled', classes: 'bg-sky-50 text-sky-800 border-sky-200' },
  in_progress: { label: 'In Progress', classes: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  did_not_attend: { label: 'Did Not Attend', classes: 'bg-rose-50 text-rose-700 border-rose-200' },

  no_result: { label: 'No Result', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  winner: { label: 'Winner (1st)', classes: 'bg-amber-50 text-amber-900 border-amber-300' },
  runner_up: { label: 'Runner-Up (2nd)', classes: 'bg-indigo-50 text-indigo-800 border-indigo-200' },
  third_place: { label: '3rd Place', classes: 'bg-orange-50 text-orange-800 border-orange-200' },
  finalist: { label: 'Finalist', classes: 'bg-violet-50 text-violet-800 border-violet-200' },
  participant: { label: 'Participant', classes: 'bg-teal-50 text-teal-800 border-teal-200' },
  disqualified: { label: 'Disqualified', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export type AnyStatus =
  | EventStatus
  | GameRegistrationStatus
  | RegistrationStatus
  | SelectionStatus
  | MatchStatus
  | MatchResult;

export function getStatusLabel(value: string): string {
  return LABELS[value]?.label || value.replace(/_/g, ' ');
}

export function StatusTag({ status }: { status: AnyStatus | string }) {
  const entry = LABELS[status] || {
    label: status.replace(/_/g, ' '),
    classes: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-md border whitespace-nowrap shrink-0 ${entry.classes}`}
    >
      {entry.label}
    </span>
  );
}

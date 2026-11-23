import type { Timestamp } from 'firebase/firestore';

export function formatDate(ts?: Timestamp | null): string {
  if (!ts?.toDate) return 'To be announced';
  return ts.toDate().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(ts?: Timestamp | null): string {
  if (!ts?.toDate) return 'To be announced';
  return ts.toDate().toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toLocalDateTimeInputValue(ts?: Timestamp | null, fallbackDaysAhead = 0): string {
  const d = ts?.toDate ? ts.toDate() : new Date(Date.now() + fallbackDaysAhead * 86400000);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

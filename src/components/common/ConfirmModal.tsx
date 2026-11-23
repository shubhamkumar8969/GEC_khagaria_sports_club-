import React, { useState } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmTone?: 'primary' | 'danger';
  requireReason?: boolean;
  reasonLabel?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  confirmTone = 'primary',
  requireReason = false,
  reasonLabel = 'Optional note / reason',
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-lg">
        <h2 id="confirm-modal-title" className="text-lg font-bold text-[#142D50]">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p>

        <div className="mt-4">
          <label htmlFor="confirm-reason" className="block text-xs font-medium text-slate-700 mb-1.5">
            {reasonLabel} {requireReason ? '(Required)' : ''}
          </label>
          <textarea
            id="confirm-reason"
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter note for status history and audit log..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[#142D50] focus:outline-none"
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || (requireReason && !reason.trim())}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
              confirmTone === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#142D50] hover:bg-[#1e4273]'
            }`}
          >
            {submitting ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

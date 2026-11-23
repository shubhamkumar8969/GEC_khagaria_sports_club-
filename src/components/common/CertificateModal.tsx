import { useEffect, useState } from 'react';
import { Award, Download, Printer, X } from 'lucide-react';
import {
  downloadCertificatePng,
  renderCertificateCanvas,
  type CertificateData,
} from '@/src/utils/certificateGenerator';

interface CertificateModalProps {
  open: boolean;
  data: CertificateData | null;
  onClose: () => void;
}

export function CertificateModal({ open, data, onClose }: CertificateModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
    if (!open || !data) {
      setPreviewUrl(null);
      return;
    }
    if (data.customImageUrl && data.customImageUrl.trim().length > 0) {
      setPreviewUrl(data.customImageUrl);
      return;
    }
    const canvas = renderCertificateCanvas(data);
    setPreviewUrl(canvas.toDataURL('image/png'));
  }, [open, data]);

  if (!open || !data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cert-modal-title"
    >
      <div className="card-3d rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <Award className="w-5 h-5 text-red-400 shrink-0" />
            <div className="min-w-0">
              <h2 id="cert-modal-title" className="font-display text-base font-bold text-white truncate">
                {data.certificateTitle || 'Official Sports Club Certificate'}
              </h2>
              <p className="text-xs font-mono text-blue-300 truncate">{data.certificateId}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
            aria-label="Close certificate preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-[#07090F] flex flex-col items-center justify-center gap-4">
          {previewUrl && !imageFailed ? (
            <img
              src={previewUrl}
              alt={`${data.certificateTitle} for ${data.participantName}`}
              referrerPolicy="no-referrer"
              onError={() => {
                setImageFailed(true);
                const canvas = renderCertificateCanvas(data);
                setPreviewUrl(canvas.toDataURL('image/png'));
              }}
              className="w-full max-w-3xl rounded-lg border border-blue-500/35 shadow-xl bg-white"
            />
          ) : (
            <div className="h-64 w-full max-w-2xl bg-[#10172A] rounded-lg animate-pulse" />
          )}

          {data.customImageUrl && (
            <div className="w-full max-w-3xl bg-[#0B101D] border border-blue-500/30 rounded-lg px-4 py-3 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
              <span>
                Issued to <strong className="text-white">{data.participantName}</strong> · Reg No:{' '}
                <strong className="font-mono text-blue-300">{data.enrollmentNumber}</strong> · {data.branch} ({data.year}
                {data.batch ? `, Batch ${data.batch}` : ''})
              </span>
              <span className="font-semibold text-red-300">{data.eventName}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 bg-[#0B101D] flex flex-wrap items-center justify-between gap-3 no-print">
          <p className="text-xs text-slate-300">
            Issued to <span className="font-semibold text-white">{data.participantName}</span> ({data.enrollmentNumber})
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#080B14] border border-white/20 rounded-lg hover:border-blue-400"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={() => downloadCertificatePng(data)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg btn-3d-red"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Certificate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

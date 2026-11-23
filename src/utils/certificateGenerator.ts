import type { SiteSettings } from '@/src/types/models';

export interface CertificateData {
  certificateId: string;
  certificateTitle: string;
  certificateNote: string;
  participantName: string;
  enrollmentNumber: string;
  branch: string;
  batch?: string;
  year: string;
  teamName?: string;
  eventName: string;
  gameName: string;
  registrationReference: string;
  resultLabel: string;
  issuedAtText: string;
  customImageUrl?: string;
  settings: SiteSettings;
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function renderCertificateCanvas(data: CertificateData): HTMLCanvasElement {
  const width = 2000;
  const height = 1414;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Warm parchment paper background
  ctx.fillStyle = '#FDFBF7';
  ctx.fillRect(0, 0, width, height);

  // Subtle watermark grid accent
  ctx.save();
  ctx.strokeStyle = 'rgba(20, 45, 80, 0.035)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 390, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, 340, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Outer Navy Frame
  ctx.strokeStyle = '#142D50';
  ctx.lineWidth = 24;
  ctx.strokeRect(44, 44, width - 88, height - 88);

  // Inner Amber Gold Accent Frame
  ctx.strokeStyle = '#F28C28';
  ctx.lineWidth = 5;
  ctx.strokeRect(76, 76, width - 152, height - 152);

  // Corner Geometric Seals
  const corners: Array<[number, number]> = [
    [94, 94],
    [width - 94, 94],
    [94, height - 94],
    [width - 94, height - 94],
  ];
  ctx.fillStyle = '#142D50';
  for (const [cx, cy] of corners) {
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Top Header Crest Circle
  ctx.fillStyle = '#142D50';
  ctx.beginPath();
  ctx.arc(width / 2, 188, 52, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#F28C28';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(width / 2, 188, 43, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 28px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('GEC', width / 2, 198);

  // Institution & Club Title
  ctx.fillStyle = '#142D50';
  ctx.font = '700 34px Georgia, serif';
  ctx.fillText(data.settings.institutionName.toUpperCase(), width / 2, 286);

  ctx.fillStyle = '#F28C28';
  ctx.font = '700 24px Inter, sans-serif';
  ctx.fillText(data.settings.clubName.toUpperCase(), width / 2, 326);

  // Certificate Main Title
  ctx.fillStyle = '#142D50';
  ctx.font = '700 64px Georgia, serif';
  ctx.fillText((data.certificateTitle || 'CERTIFICATE OF PARTICIPATION').toUpperCase(), width / 2, 430);

  ctx.fillStyle = '#475569';
  ctx.font = '500 24px Inter, sans-serif';
  ctx.fillText(
    data.settings.certificateHeaderSubtitle ||
      'Official Recognition of Athletic Excellence & Participation',
    width / 2,
    476
  );

  // Decorative divider
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(460, 514);
  ctx.lineTo(width - 460, 514);
  ctx.stroke();

  ctx.fillStyle = '#475569';
  ctx.font = '400 28px Georgia, serif';
  ctx.fillText('This is to proudly certify that', width / 2, 578);

  // Recipient Name
  ctx.fillStyle = '#0F1E33';
  ctx.font = 'italic 700 62px Georgia, serif';
  ctx.fillText(data.participantName, width / 2, 662);

  // Underline for name
  ctx.strokeStyle = '#F28C28';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(520, 682);
  ctx.lineTo(width - 520, 682);
  ctx.stroke();

  // Academic & Team Metadata
  ctx.fillStyle = '#334155';
  ctx.font = '600 25px Inter, sans-serif';
  const parts = [
    `Reg No: ${data.enrollmentNumber}`,
    `${data.branch} (${data.year})`,
    ...(data.batch ? [`Batch: ${data.batch}`] : []),
    ...(data.teamName ? [`Team: ${data.teamName}`] : []),
  ];
  ctx.fillText(parts.join('   |   '), width / 2, 738);

  // Achievement / Event Paragraph
  const statement =
    data.certificateNote ||
    `has participated with sportsmanship in ${data.gameName} during ${data.eventName} organized by ${data.settings.clubName}, ${data.settings.institutionName}, achieving the distinction of ${data.resultLabel}.`;

  ctx.fillStyle = '#1E293B';
  ctx.font = '400 29px Georgia, serif';
  const lines = wrapTextLines(ctx, statement, 1420);
  lines.slice(0, 3).forEach((line, idx) => {
    ctx.fillText(line, width / 2, 818 + idx * 44);
  });

  // Verification Badge Box
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(600, 964, 800, 74);
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  ctx.strokeRect(600, 964, 800, 74);

  ctx.fillStyle = '#142D50';
  ctx.font = '600 22px monospace';
  ctx.fillText(
    `Certificate ID: ${data.certificateId}   ·   Ref: ${data.registrationReference}`,
    width / 2,
    1009
  );

  // Signatory Blocks
  const sigY = 1190;
  ctx.strokeStyle = '#142D50';
  ctx.lineWidth = 2;

  // Left: Student Coordinator
  ctx.beginPath();
  ctx.moveTo(240, sigY);
  ctx.lineTo(640, sigY);
  ctx.stroke();
  ctx.fillStyle = '#0F1E33';
  ctx.font = '700 24px Inter, sans-serif';
  ctx.fillText(data.settings.studentCoordinator, 440, sigY + 38);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 20px Inter, sans-serif';
  ctx.fillText('Student Sports Secretary', 440, sigY + 68);

  // Center: Issue Date Stamp
  ctx.fillStyle = '#0F1E33';
  ctx.font = '700 22px Inter, sans-serif';
  ctx.fillText(data.issuedAtText, width / 2, sigY + 26);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 20px Inter, sans-serif';
  ctx.fillText('Date of Issue', width / 2, sigY + 58);

  // Right: Faculty Coordinator
  ctx.beginPath();
  ctx.moveTo(width - 640, sigY);
  ctx.lineTo(width - 240, sigY);
  ctx.stroke();
  ctx.fillStyle = '#0F1E33';
  ctx.font = '700 24px Inter, sans-serif';
  ctx.fillText(data.settings.facultyCoordinator, width - 440, sigY + 38);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 20px Inter, sans-serif';
  ctx.fillText(
    data.settings.certificateAuthorityTitle || 'Faculty In-Charge, Sports Club',
    width - 440,
    sigY + 68
  );

  // Bottom Footer Verification Note
  ctx.fillStyle = '#64748B';
  ctx.font = '400 18px Inter, sans-serif';
  ctx.fillText(
    data.settings.certificateFooterNote ||
      `Verified official digital certificate · ${data.settings.clubName}`,
    width / 2,
    1320
  );

  return canvas;
}

export function downloadCertificatePng(data: CertificateData): void {
  const safeRef = (data.certificateId || data.enrollmentNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (data.customImageUrl && data.customImageUrl.startsWith('data:image/')) {
    const link = document.createElement('a');
    link.download = `${safeRef}.jpg`;
    link.href = data.customImageUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }

  if (data.customImageUrl && data.customImageUrl.startsWith('http')) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 1600;
      c.height = img.naturalHeight || 1131;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const link = document.createElement('a');
        link.download = `${safeRef}.png`;
        link.href = c.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };
    img.onerror = () => {
      const canvas = renderCertificateCanvas(data);
      const link = document.createElement('a');
      link.download = `${safeRef}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = data.customImageUrl;
    return;
  }

  const canvas = renderCertificateCanvas(data);
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `${safeRef}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

import { useState } from 'react';
import { Trophy } from 'lucide-react';

interface SportBannerGraphicProps {
  bannerUrl?: string;
  title: string;
  subtitle?: string;
  className?: string;
}

const BANNER_THEMES = [
  {
    bg: 'from-[#07090F] via-[#1E3A8A] to-[#991B1B]',
    accent: '#EF4444',
    secondary: '#60A5FA',
    iconBg: 'bg-red-500/25 border-red-400/50 text-red-200',
  },
  {
    bg: 'from-[#2A0810] via-[#B91C1C] to-[#0B1224]',
    accent: '#60A5FA',
    secondary: '#F87171',
    iconBg: 'bg-blue-500/25 border-blue-400/50 text-blue-200',
  },
  {
    bg: 'from-[#090D18] via-[#1D4ED8] to-[#0F172A]',
    accent: '#EF4444',
    secondary: '#93C5FD',
    iconBg: 'bg-blue-600/30 border-blue-300/50 text-white',
  },
  {
    bg: 'from-[#7F1D1D] via-[#111827] to-[#1D4ED8]',
    accent: '#F87171',
    secondary: '#60A5FA',
    iconBg: 'bg-red-600/30 border-red-300/50 text-white',
  },
  {
    bg: 'from-[#090B12] via-[#172554] to-[#7F1D1D]',
    accent: '#93C5FD',
    secondary: '#FCA5A5',
    iconBg: 'bg-slate-900/70 border-blue-400/50 text-blue-200',
  },
];

function getThemeIndex(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return hash % BANNER_THEMES.length;
}

export function SportBannerGraphic({
  bannerUrl,
  title,
  subtitle,
  className = 'h-48',
}: SportBannerGraphicProps) {
  const [failed, setFailed] = useState(false);

  if (bannerUrl && !failed) {
    return (
      <div className={`relative overflow-hidden bg-[#07090F] ${className}`}>
        <img
          src={bannerUrl}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07090F]/90 via-[#0C1428]/35 to-transparent" />
      </div>
    );
  }

  const theme = BANNER_THEMES[getThemeIndex(title || 'Sports')];

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${theme.bg} flex flex-col justify-end p-6 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 400 200"
        className="absolute inset-0 w-full h-full opacity-35 pointer-events-none"
        preserveAspectRatio="xMidYMid slice"
      >
        <circle cx="340" cy="40" r="112" fill="none" stroke={theme.accent} strokeWidth="2" />
        <circle cx="340" cy="40" r="78" fill="none" stroke="#FFFFFF" strokeWidth="1.25" />
        <circle cx="340" cy="40" r="42" fill="none" stroke={theme.secondary} strokeWidth="1.25" />
        <path d="M-20 175 Q 160 90 420 155" fill="none" stroke={theme.accent} strokeWidth="2.5" />
        <path d="M-20 190 Q 160 112 420 172" fill="none" stroke={theme.secondary} strokeWidth="1.25" />
        <line x1="0" y1="28" x2="155" y2="28" stroke="#FFFFFF" strokeWidth="0.9" strokeDasharray="5 4" />
      </svg>
      <div className="relative z-10 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 shadow-md ${theme.iconBg}`}
        >
          <Trophy className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-base font-display font-bold text-white truncate drop-shadow-sm">
            {title}
          </p>
          {subtitle && <p className="text-xs text-slate-200/85 truncate">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

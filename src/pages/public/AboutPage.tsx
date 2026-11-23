import { Link } from 'react-router-dom';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { useSiteSettings } from '@/src/app/SettingsContext';

export function AboutPage() {
  const { settings } = useSiteSettings();

  return (
    <PublicLayout>
      <section className="bg-subpage-arena text-white py-14 border-b border-blue-500/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold text-red-400">{settings.institutionName}</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
            About {settings.clubName}
          </h1>
          <p className="mt-4 text-base text-slate-300 max-w-2xl leading-relaxed">
            {settings.tagline}
          </p>
        </div>
      </section>

      <section className="bg-campus-tint min-h-[60vh]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
          <div className="card-3d-blue rounded-2xl p-8">
            <h2 className="font-display text-xl font-bold text-white">
              {settings.aboutMissionTitle}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
              {settings.aboutMissionBody}
            </p>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/10">
              {settings.aboutHighlights.map((item, idx) => (
                <div
                  key={`${item.title}-${idx}`}
                  className="p-4 rounded-xl bg-[#080C17] border border-blue-500/25"
                >
                  <h3 className="font-display text-base font-bold text-white">
                    <span className="text-red-400 font-mono mr-1.5">0{idx + 1}.</span>
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-300">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card-3d-red rounded-2xl p-8">
            <h2 className="font-display text-xl font-bold text-white">
              Club Leadership &amp; Branches
            </h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pb-6 border-b border-white/10">
              <div className="p-4 bg-[#080C17] rounded-xl border border-blue-500/30">
                <p className="text-xs font-medium text-blue-300">Faculty Sports Coordinator</p>
                <p className="mt-1 font-semibold text-white">{settings.facultyCoordinator}</p>
              </div>
              <div className="p-4 bg-[#080C17] rounded-xl border border-red-500/30">
                <p className="text-xs font-medium text-red-300">Student Sports Coordinator</p>
                <p className="mt-1 font-semibold text-white">{settings.studentCoordinator}</p>
              </div>
            </div>

            <p className="mt-6 text-sm text-slate-300">
              Participating academic branches managed dynamically by Sports Club administrators:
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-white">
              {settings.branches.map((branch, idx) => (
                <span
                  key={branch}
                  className="px-4 py-2 bg-[#080C17] border border-blue-500/30 rounded-xl"
                >
                  <span className="text-red-400 font-mono mr-1">0{idx + 1}.</span>
                  {branch}
                </span>
              ))}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10 flex flex-wrap gap-4">
              <Link
                to="/events"
                className="px-5 py-2.5 text-sm font-semibold rounded-lg btn-3d-red"
              >
                Browse Live Events
              </Link>
              <Link
                to="/results"
                className="px-5 py-2.5 text-sm font-semibold rounded-lg btn-3d-blue"
              >
                View Results Panel
              </Link>
              <Link
                to="/contact"
                className="px-5 py-2.5 text-sm font-medium text-slate-200 bg-[#080C17] border border-white/15 rounded-lg hover:border-blue-400 transition-colors"
              >
                Contact Coordinators
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

import { Mail, MapPin, Phone, UserCheck } from 'lucide-react';
import { PublicLayout } from '@/src/components/layout/PublicLayout';
import { useSiteSettings } from '@/src/app/SettingsContext';

export function ContactPage() {
  const { settings } = useSiteSettings();

  return (
    <PublicLayout>
      <section className="bg-subpage-arena text-white py-12 border-b border-blue-500/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
            {settings.clubName}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">Contact Sports Club</h1>
          <p className="mt-2 text-sm text-slate-300">
            Official coordination contacts for {settings.institutionName}.
          </p>
        </div>
      </section>

      <section className="bg-campus-tint min-h-[60vh]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card-3d-blue rounded-2xl p-6 space-y-5">
              <h2 className="font-display text-xl font-bold text-white">Club Office Details</h2>

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-blue-300">Campus Address</p>
                  <p className="text-sm font-medium text-white">{settings.campusAddress}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-blue-300">Official Email</p>
                  <p className="text-sm font-medium text-white">{settings.contactEmail}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-blue-300">Helpline / Office Phone</p>
                  <p className="text-sm font-medium text-white font-mono">
                    {settings.contactPhone}
                  </p>
                </div>
              </div>
            </div>

            <div className="card-3d-red rounded-2xl p-6 space-y-5">
              <h2 className="font-display text-xl font-bold text-white">Coordinators</h2>

              <div className="flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-red-300">Faculty Sports Coordinator</p>
                  <p className="text-sm font-medium text-white">{settings.facultyCoordinator}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-red-300">Student Sports Coordinator</p>
                  <p className="text-sm font-medium text-white">{settings.studentCoordinator}</p>
                </div>
              </div>

              <p className="pt-4 border-t border-white/10 text-xs text-slate-400 leading-relaxed">
                Administrators can update verified institutional contact details, coordinator names,
                and branch lists anytime from Admin Portal → Site Settings.
              </p>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

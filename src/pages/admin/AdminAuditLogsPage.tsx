import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { AdminLayout } from '@/src/components/layout/AdminLayout';
import { useAuth } from '@/src/app/AuthContext';
import { listAuditLogs } from '@/src/services/firebase/audit';
import { formatDateTime } from '@/src/utils/formatters';
import type { AuditLog } from '@/src/types/models';

export function AdminAuditLogsPage() {
  const { adminProfile } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!adminProfile) return;
    let active = true;
    listAuditLogs(adminProfile)
      .then((list) => {
        if (active) setLogs(list);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load audit logs.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [adminProfile]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(
      (l) =>
        l.summary.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q)
    );
  }, [logs, search]);

  return (
    <AdminLayout title="Audit Logs" breadcrumb="Admin / Audit Logs">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            Append-only log of event changes, participant approvals, bulk actions, exports, and
            role updates.
          </p>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action, actor, summary..."
              className="w-full pl-9 pr-3 py-2 bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Loading audit trail...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No audit entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#142D50]">{log.actorName}</p>
                        <p className="text-slate-400">{log.actorEmail}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-[#F28C28]">{log.action}</td>
                      <td className="py-3 px-4 text-slate-700">{log.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

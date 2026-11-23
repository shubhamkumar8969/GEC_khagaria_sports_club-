import * as XLSX from 'xlsx';
import { escapeSpreadsheetCell, maskEmail, maskPhone } from '@/src/schemas/validation';
import { writeAuditLog } from '@/src/services/firebase/audit';
import type { AdminUser, EventGame, Registration } from '@/src/types/models';

export interface ExportOptions {
  format: 'xlsx' | 'csv';
  scopeLabel: string;
  registrations: Registration[];
  gamesById?: Record<string, EventGame>;
  actor: AdminUser;
  filterSummary?: string;
}

function formatDate(ts?: { toDate?: () => Date }): string {
  if (!ts?.toDate) return '';
  return ts.toDate().toISOString().replace('T', ' ').slice(0, 19);
}

export async function exportRegistrations(options: ExportOptions): Promise<void> {
  const { format, scopeLabel, registrations, gamesById = {}, actor, filterSummary = '' } = options;
  const includeFullPII = actor.role === 'super_admin' || actor.role === 'event_admin';

  // Sheet 1 — Registrations
  const regRows = registrations.map((r) => ({
    'Registration ID': escapeSpreadsheetCell(r.id),
    'Reference Code': escapeSpreadsheetCell(r.registrationReference),
    Event: escapeSpreadsheetCell(r.eventName),
    Game: escapeSpreadsheetCell(r.gameName),
    'Participation Type': escapeSpreadsheetCell(r.participationType),
    'Participant / Captain Name': escapeSpreadsheetCell(r.participant.fullName),
    'Enrollment Number': escapeSpreadsheetCell(r.participant.enrollmentNumber),
    Branch: escapeSpreadsheetCell(r.participant.branch),
    Year: escapeSpreadsheetCell(r.participant.year),
    Phone: escapeSpreadsheetCell(includeFullPII ? r.participant.phone : maskPhone(r.participant.phone)),
    Email: escapeSpreadsheetCell(includeFullPII ? r.participant.email : maskEmail(r.participant.email)),
    'Team Name': escapeSpreadsheetCell(r.team.teamName),
    'Team Size': r.team.members?.length || 1,
    'Registration Status': escapeSpreadsheetCell(r.registrationStatus),
    'Selection Status': escapeSpreadsheetCell(r.selectionStatus),
    'Team Assignment': escapeSpreadsheetCell(r.teamAssignment),
    'Match Status': escapeSpreadsheetCell(r.matchStatus),
    Result: escapeSpreadsheetCell(r.result),
    'Submitted At (UTC)': formatDate(r.createdAt),
    'Updated At (UTC)': formatDate(r.updatedAt),
  }));

  if (format === 'csv') {
    const ws = XLSX.utils.json_to_sheet(regRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `gec-sports-${slugTime()}.csv`);
  } else {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Registrations
    const wsReg = XLSX.utils.json_to_sheet(
      regRows.length > 0 ? regRows : [{ Notice: 'No registrations matched the selected export criteria.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsReg, 'Registrations');

    // Sheet 2: Team Members
    const memberRows: Array<Record<string, string | number>> = [];
    for (const r of registrations) {
      if (r.team.members && r.team.members.length > 0) {
        r.team.members.forEach((m, idx) => {
          memberRows.push({
            'Registration ID': escapeSpreadsheetCell(r.id),
            'Reference Code': escapeSpreadsheetCell(r.registrationReference),
            Event: escapeSpreadsheetCell(r.eventName),
            Game: escapeSpreadsheetCell(r.gameName),
            'Team Name': escapeSpreadsheetCell(r.team.teamName),
            'Member #': idx + 1,
            'Member Name': escapeSpreadsheetCell(m.fullName),
            'Enrollment Number': escapeSpreadsheetCell(m.enrollmentNumber),
            Branch: escapeSpreadsheetCell(m.branch),
            Year: escapeSpreadsheetCell(m.year),
            Role: escapeSpreadsheetCell(m.roleLabel || (idx === 0 ? 'Captain' : 'Player')),
            'Registration Status': escapeSpreadsheetCell(r.registrationStatus),
          });
        });
      }
    }
    const wsMembers = XLSX.utils.json_to_sheet(
      memberRows.length > 0 ? memberRows : [{ Notice: 'No team or doubles entries in selection.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsMembers, 'Team Members');

    // Sheet 3: Summary
    const summaryMap = new Map<string, number>();
    const branchMap = new Map<string, number>();
    const statusMap = new Map<string, number>();

    for (const r of registrations) {
      const egKey = `${r.eventName} :: ${r.gameName}`;
      summaryMap.set(egKey, (summaryMap.get(egKey) ?? 0) + 1);
      branchMap.set(r.participant.branch, (branchMap.get(r.participant.branch) ?? 0) + 1);
      statusMap.set(r.registrationStatus, (statusMap.get(r.registrationStatus) ?? 0) + 1);
    }

    const summaryRows: Array<Record<string, string | number>> = [
      { Section: 'Scope', Key: scopeLabel, Count: registrations.length },
      ...Array.from(summaryMap.entries()).map(([k, count]) => ({
        Section: 'Event / Game',
        Key: escapeSpreadsheetCell(k),
        Count: count,
      })),
      ...Array.from(branchMap.entries()).map(([k, count]) => ({
        Section: 'Branch',
        Key: escapeSpreadsheetCell(k),
        Count: count,
      })),
      ...Array.from(statusMap.entries()).map(([k, count]) => ({
        Section: 'Registration Status',
        Key: escapeSpreadsheetCell(k),
        Count: count,
      })),
    ];
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Sheet 4: Custom Answers
    const customRows: Array<Record<string, string>> = [];
    for (const r of registrations) {
      const game = gamesById[r.gameId];
      const entries = Object.entries(r.customAnswers || {});
      for (const [fieldId, answer] of entries) {
        const fieldDef = game?.customFields?.find((f) => f.id === fieldId);
        const formattedAnswer = Array.isArray(answer) ? answer.join(', ') : String(answer ?? '');
        customRows.push({
          'Registration ID': escapeSpreadsheetCell(r.id),
          'Reference Code': escapeSpreadsheetCell(r.registrationReference),
          Game: escapeSpreadsheetCell(r.gameName),
          'Field Label': escapeSpreadsheetCell(fieldDef?.label || fieldId),
          Answer: escapeSpreadsheetCell(formattedAnswer),
        });
      }
    }
    const wsCustom = XLSX.utils.json_to_sheet(
      customRows.length > 0 ? customRows : [{ Notice: 'No custom field responses in exported records.' }]
    );
    XLSX.utils.book_append_sheet(wb, wsCustom, 'Custom Answers');

    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbOut], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    triggerDownload(blob, `gec-sports-${slugTime()}.xlsx`);
  }

  await writeAuditLog({
    actor,
    action: `export.${format}`,
    entityType: 'export',
    entityId: scopeLabel,
    summary: `Exported ${registrations.length} registrations (${format.toUpperCase()}) — ${scopeLabel}${
      filterSummary ? ` [${filterSummary}]` : ''
    }`,
    metadata: { count: registrations.length, format, piiIncluded: includeFullPII },
  });
}

function slugTime(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Phase 0 Security Test Suite for Firestore Security Rules.
 * Run against Firebase Emulator Suite when @firebase/rules-unit-testing is configured.
 * Verifies all "Dirty Dozen" payloads from security_spec.md return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  expected: 'PERMISSION_DENIED';
  description: string;
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Registration Read',
    collection: 'registrations',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Public visitor attempts to list registrations containing student PII.',
  },
  {
    id: 2,
    name: 'Unverified Email Admin Spoof',
    collection: 'registrations',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Authenticated user with email_verified=false spoofing admin email.',
  },
  {
    id: 3,
    name: 'Self-Assigned Super Admin',
    collection: 'admins',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Uninvited user attempts to write their own /admins/{uid} doc with super_admin role.',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Registration',
    collection: 'registrations',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Registrant injects unallowed ghost key isApprovedOverride: true.',
  },
  {
    id: 5,
    name: 'Status Skipping on Registration Create',
    collection: 'registrations',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Registrant forces registrationStatus=approved or result=winner on create.',
  },
  {
    id: 6,
    name: 'Closed Event Registration',
    collection: 'registrations',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Registrant targets an event with status=registration_closed or draft.',
  },
  {
    id: 7,
    name: 'Timestamp Forgery',
    collection: 'registrations',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Client supplies past timestamp instead of serverTimestamp().',
  },
  {
    id: 8,
    name: 'Cross-Event Admin Escalation',
    collection: 'registrations',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Event admin assigned to eventA attempts update on eventB registration.',
  },
  {
    id: 9,
    name: 'Lookup Collection Scraping',
    collection: 'registrationLookups',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    description: 'Public visitor attempts list query on registrationLookups.',
  },
  {
    id: 10,
    name: 'Audit Log Tampering',
    collection: 'auditLogs',
    operation: 'delete',
    expected: 'PERMISSION_DENIED',
    description: 'Super admin attempts to delete or mutate an append-only audit log entry.',
  },
  {
    id: 11,
    name: 'Oversized Resource Poisoning',
    collection: 'registrations',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Payload includes 10KB string field exceeding schema maxLength.',
  },
  {
    id: 12,
    name: 'Counter Inflation Without Registration',
    collection: 'gameCounters',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Caller increments gameCounters without atomic new registration document write in the same transaction.',
  },
  {
    id: 13,
    name: 'Duplicate Enrollment Hijack',
    collection: 'enrollmentLocks',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    description: 'Student B attempts to overwrite Student A enrollmentLocks/{regNoHash} doc to claim duplicate enrollment number.',
  },
  {
    id: 14,
    name: 'Student Profile Missing Lock',
    collection: 'studentProfiles',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    description: 'Student creates studentProfiles/{uid} without writing matching enrollmentLocks/{regNoHash} in the same transaction.',
  },
];

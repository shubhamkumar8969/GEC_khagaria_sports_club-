import { z } from 'zod';
import type { CustomFieldDefinition } from '@/src/types/models';

// Blueprint synchronized constants
export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const SLUG_PATTERN = /^[a-z0-9-]+$/;
export const PHONE_PATTERN = /^[0-9+\-\s()]{7,20}$/;

export function normalizeEnrollment(val: string): string {
  return val.trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizePhone(val: string): string {
  const digits = val.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits || val.trim();
}

export function sanitizeId(raw: string): string {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 120);
}

export function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'event';
}

export function generateId(prefix = ''): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 14);
  return prefix ? `${prefix}_${token}` : token;
}

export function generateRegistrationReference(eventSlug = 'GEC'): string {
  const code = eventSlug.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) || 'CLUB';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < bytes.length; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `GEC-${code}-${suffix}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeRegNoHash(registrationNumber: string): Promise<string> {
  return sha256Hex(normalizeEnrollment(registrationNumber));
}

export async function computeLookupKey(reference: string, enrollmentNumber: string): Promise<string> {
  const normalized = `${reference.trim().toUpperCase()}::${normalizeEnrollment(enrollmentNumber)}`;
  return sha256Hex(normalized);
}

export async function computeStudentPortalKey(enrollmentNumber: string, phone: string): Promise<string> {
  const normalized = `${normalizeEnrollment(enrollmentNumber)}::${normalizePhone(phone)}`;
  return sha256Hex(normalized);
}

export function generateCertificateId(reference: string): string {
  const cleanRef = reference.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(-6) || 'GECSC';
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < bytes.length; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `CERT-GEC-${cleanRef}-${suffix}`;
}

export async function computeInviteId(email: string): Promise<string> {
  const hex = await sha256Hex(email.trim().toLowerCase());
  return `inv_${hex.slice(0, 40)}`;
}

export function maskPhone(phone: string): string {
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  return `${'*'.repeat(Math.max(clean.length - 4, 4))}${clean.slice(-4)}`;
}

export function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [user, domain] = parts;
  const visible = user.slice(0, 2);
  return `${visible}***@${domain}`;
}

export function escapeSpreadsheetCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

export const SEMESTER_OPTIONS = [
  '1st Sem',
  '2nd Sem',
  '3rd Sem',
  '4th Sem',
  '5th Sem',
  '6th Sem',
  '7th Sem',
  '8th Sem',
] as const;

export const studentProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  registrationNumber: z
    .string()
    .trim()
    .min(2, 'Enrollment / Registration number is required')
    .max(40, 'Enrollment number max 40 characters'),
  branch: z.string().trim().min(1, 'Academic branch is required').max(80),
  batch: z.string().trim().max(40).optional().default(''),
  year: z.string().trim().min(1, 'Current year is required').max(30),
  semester: z.string().trim().min(1, 'Current semester is required').max(30),
  phone: z
    .string()
    .trim()
    .min(10, 'Mobile number must be at least 10 digits')
    .max(20)
    .refine(
      (val) => PHONE_PATTERN.test(val) && normalizePhone(val).length >= 10,
      'Enter a valid 10-digit mobile number'
    ),
});

export const participantSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120, 'Name max 120 characters'),
  enrollmentNumber: z
    .string()
    .trim()
    .min(2, 'Enrollment / Registration number is required')
    .max(40, 'Enrollment number max 40 characters'),
  branch: z.string().trim().min(1, 'Branch is required').max(80),
  year: z.string().trim().min(1, 'Current year is required').max(30),
  semester: z.string().trim().max(30).optional().default(''),
  phone: z
    .string()
    .trim()
    .regex(PHONE_PATTERN, 'Enter a valid phone number (7–20 digits)')
    .refine((val) => normalizePhone(val).length >= 10, 'Enter at least 10 phone digits'),
  email: z
    .string()
    .trim()
    .max(200)
    .refine((val) => val === '' || z.string().email().safeParse(val).success, 'Enter a valid email address'),
});

export const teamMemberSchema = z.object({
  fullName: z.string().trim().max(120).optional().default(''),
  enrollmentNumber: z.string().trim().max(40).optional().default(''),
  branch: z.string().trim().max(80).optional().default(''),
  year: z.string().trim().max(30).optional().default(''),
  roleLabel: z.string().trim().max(40).optional(),
});

export const eventFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Event name is required').max(140),
    slug: z.string().trim().min(2, 'Slug is required').max(140).regex(SLUG_PATTERN, 'Use lowercase letters, numbers, and hyphens only'),
    shortDescription: z.string().trim().min(2, 'Short summary is required').max(300),
    description: z.string().trim().max(5000),
    highlightsText: z.string().trim().max(4000).optional().default(''),
    bannerUrl: z.string().trim().max(450000),
    venue: z.string().trim().max(200),
    startAt: z.string().min(1, 'Start date is required'),
    endAt: z.string().min(1, 'End date is required'),
    registrationStartAt: z.string().min(1, 'Registration open date is required'),
    registrationEndAt: z.string().min(1, 'Registration close date is required'),
    status: z.enum(['draft', 'published', 'registration_open', 'registration_closed', 'ongoing', 'completed', 'archived']),
    featured: z.boolean(),
    autoApprove: z.boolean(),
    showPublicResults: z.boolean(),
  })
  .refine((data) => new Date(data.endAt).getTime() >= new Date(data.startAt).getTime(), {
    message: 'Event end date must be on or after start date',
    path: ['endAt'],
  })
  .refine((data) => new Date(data.registrationEndAt).getTime() >= new Date(data.registrationStartAt).getTime(), {
    message: 'Registration closing date must be on or after opening date',
    path: ['registrationEndAt'],
  });

export const gameFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Game name is required').max(120),
    category: z.enum(['Indoor', 'Outdoor', 'Athletics', 'Esports', 'Other']),
    participationType: z.enum(['individual', 'doubles', 'team']),
    description: z.string().trim().max(3000),
    rules: z.string().trim().max(5000),
    maxParticipants: z.number().int().min(0).max(10000),
    maxTeams: z.number().int().min(0).max(5000),
    minTeamSize: z.number().int().min(1).max(30),
    maxTeamSize: z.number().int().min(1).max(30),
    registrationDeadline: z.string().min(1, 'Registration deadline is required'),
    registrationStatus: z.enum(['draft', 'open', 'closed']),
    eligibility: z.string().trim().max(500),
    sortOrder: z.number().int().min(0).max(1000),
  })
  .refine((data) => data.maxTeamSize >= data.minTeamSize, {
    message: 'Max team size must be greater than or equal to min team size',
    path: ['maxTeamSize'],
  });

export function validateCustomAnswers(
  fields: CustomFieldDefinition[],
  answers: Record<string, string | number | boolean | string[]>
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const val = answers[field.id];
    if (field.required) {
      if (field.type === 'checkboxes') {
        if (!Array.isArray(val) || val.length === 0) {
          errors[field.id] = `Please select at least one option for "${field.label}"`;
        }
      } else if (val === undefined || val === null || String(val).trim() === '') {
        errors[field.id] = `"${field.label}" is required`;
      }
    }
    if (field.type === 'number' && val !== undefined && val !== '' && Number.isNaN(Number(val))) {
      errors[field.id] = `"${field.label}" must be a valid number`;
    }
    if (typeof val === 'string' && val.length > 1000) {
      errors[field.id] = `"${field.label}" exceeds 1000 characters`;
    }
  }
  return errors;
}

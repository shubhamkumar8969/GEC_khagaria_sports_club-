import type { Timestamp } from 'firebase/firestore';

export type AdminRole = 'super_admin' | 'event_admin' | 'coordinator';

export interface AdminUser {
  uid: string;
  displayName: string;
  email: string;
  role: AdminRole;
  active: boolean;
  assignedEventIds: string[];
  permissions: string[];
  inviteId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AdminInvite {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  active: boolean;
  assignedEventIds: string[];
  permissions: string[];
  invitedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudentProfile {
  uid: string;
  fullName: string;
  registrationNumber: string;
  regNoHash: string;
  branch: string;
  batch: string;
  year: string;
  semester?: string;
  phone: string;
  email: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EnrollmentLock {
  regNoHash: string;
  uid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type StudentAccountStatus = 'active' | 'blocked';

export interface StudentAccount {
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  profileCompleted: boolean;
  fullName: string;
  registrationNumber: string;
  branch: string;
  year: string;
  semester?: string;
  phone: string;
  status: StudentAccountStatus;
  blockedReason: string;
  blockedBy: string;
  blockedByName: string;
  blockedAt?: Timestamp | null;
  loginCount: number;
  lastLoginAt: Timestamp;
  lastActiveAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type StudentActivityAction =
  | 'login'
  | 'logout'
  | 'profile_saved'
  | 'page_view'
  | 'registration_submitted'
  | 'registration_failed'
  | 'certificate_preview'
  | 'certificate_download'
  | 'blocked_access_attempt'
  | 'admin_block'
  | 'admin_unblock'
  | 'admin_remove';

export interface StudentActivity {
  id: string;
  uid: string;
  email: string;
  studentName: string;
  registrationNumber: string;
  action: StudentActivityAction;
  summary: string;
  path: string;
  eventId: string;
  gameId: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: Timestamp;
}

export type EventStatus =
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'ongoing'
  | 'completed'
  | 'archived';

export interface SportEvent {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  highlightsText?: string;
  bannerUrl: string;
  venue: string;
  startAt: Timestamp;
  endAt: Timestamp;
  registrationStartAt: Timestamp;
  registrationEndAt: Timestamp;
  status: EventStatus;
  featured: boolean;
  autoApprove: boolean;
  showPublicResults: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type GameCategory = 'Indoor' | 'Outdoor' | 'Athletics' | 'Esports' | 'Other';
export type ParticipationType = 'individual' | 'doubles' | 'team';
export type GameRegistrationStatus = 'draft' | 'open' | 'closed';

export type CustomFieldType =
  | 'short_text'
  | 'paragraph'
  | 'number'
  | 'dropdown'
  | 'single_choice'
  | 'checkboxes'
  | 'date';

export interface CustomFieldDefinition {
  id: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  helpText: string;
  options: string[];
  filterable: boolean;
  order: number;
}

export interface EventGame {
  id: string;
  eventId: string;
  name: string;
  category: GameCategory;
  participationType: ParticipationType;
  description: string;
  rules: string;
  maxParticipants: number;
  maxTeams: number;
  minTeamSize: number;
  maxTeamSize: number;
  registrationDeadline: Timestamp;
  registrationStatus: GameRegistrationStatus;
  eligibility: string;
  sortOrder: number;
  customFields: CustomFieldDefinition[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EventPhoto {
  id: string;
  eventId: string;
  eventName: string;
  title: string;
  caption: string;
  imageUrl: string;
  published: boolean;
  uploadedBy: string;
  uploadedByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type CertificateType = 'winner' | 'selected' | 'participation';
export type CertificatePlacement = 'winner' | 'runner_up' | 'third_place' | 'selected' | 'participant';

export interface IssuedCertificate {
  id: string;
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  studentUid: string;
  registrationId: string;
  regNoHash: string;
  studentName: string;
  registrationNumber: string;
  branch: string;
  batch: string;
  year: string;
  teamName: string;
  certificateType: CertificateType;
  placement: CertificatePlacement;
  certificateTitle: string;
  certificateNote: string;
  customImageUrl: string;
  issuedBy: string;
  issuedByName: string;
  issuedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CertificateIndexEntry {
  id: string;
  certId: string;
  regNoHash: string;
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  studentName: string;
  registrationNumber: string;
  branch: string;
  batch: string;
  year: string;
  teamName: string;
  certificateType: CertificateType;
  placement: CertificatePlacement;
  certificateTitle: string;
  certificateNote: string;
  customImageUrl: string;
  issuedAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GameCounter {
  id: string;
  eventId: string;
  gameId: string;
  count: number;
  lastRegistrationId: string;
  updatedAt: Timestamp;
}

export type RegistrationStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'waitlisted'
  | 'withdrawn'
  | 'cancelled';

export type SelectionStatus =
  | 'not_reviewed'
  | 'shortlisted'
  | 'selected'
  | 'not_selected';

export type MatchStatus =
  | 'not_scheduled'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'did_not_attend';

export type MatchResult =
  | 'no_result'
  | 'winner'
  | 'runner_up'
  | 'participant'
  | 'disqualified';

export interface ParticipantInfo {
  fullName: string;
  enrollmentNumber: string;
  branch: string;
  batch?: string;
  year: string;
  semester?: string;
  phone: string;
  email: string;
}

export interface TeamMember {
  fullName: string;
  enrollmentNumber: string;
  branch: string;
  year: string;
  roleLabel?: string;
}

export interface TeamInfo {
  teamName: string;
  captainName: string;
  captainEnrollment: string;
  members: TeamMember[];
}

export interface Registration {
  id: string;
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  participationType: ParticipationType;
  registrationReference: string;
  lookupKey: string;
  studentPortalKey?: string;
  studentUid?: string;
  participant: ParticipantInfo;
  team: TeamInfo;
  customAnswers: Record<string, string | number | boolean | string[]>;
  registrationStatus: RegistrationStatus;
  selectionStatus: SelectionStatus;
  teamAssignment: string;
  matchStatus: MatchStatus;
  result: MatchResult;
  certificateIssued?: boolean;
  certificateId?: string;
  certificateTitle?: string;
  certificateNote?: string;
  certificateIssuedAt?: Timestamp | null;
  adminNotes: string;
  declarationAccepted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StatusHistoryEntry {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedByName: string;
  reason: string;
  changedAt: Timestamp;
}

export interface RegistrationLookup {
  id: string;
  registrationId: string;
  registrationReference: string;
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  participantName: string;
  enrollmentNumber: string;
  branch: string;
  batch?: string;
  year: string;
  semester?: string;
  teamName: string;
  participationType: ParticipationType;
  registrationStatus: RegistrationStatus;
  selectionStatus: SelectionStatus;
  teamAssignment: string;
  matchStatus: MatchStatus;
  result: MatchResult;
  certificateIssued?: boolean;
  certificateId?: string;
  certificateTitle?: string;
  certificateNote?: string;
  certificateIssuedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StudentPortalEntry {
  id: string;
  portalKey: string;
  registrationId: string;
  registrationReference: string;
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  participantName: string;
  enrollmentNumber: string;
  branch: string;
  batch?: string;
  year: string;
  semester?: string;
  teamName: string;
  participationType: ParticipationType;
  registrationStatus: RegistrationStatus;
  selectionStatus: SelectionStatus;
  teamAssignment: string;
  matchStatus: MatchStatus;
  result: MatchResult;
  certificateIssued: boolean;
  certificateId: string;
  certificateTitle: string;
  certificateNote: string;
  certificateIssuedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ResultPlacement = 'winner' | 'runner_up' | 'third_place' | 'finalist' | 'participant';

export interface PublishedResult {
  id: string;
  eventId: string;
  eventName: string;
  gameId: string;
  gameName: string;
  category: GameCategory;
  participationType: ParticipationType;
  winnerDisplayName: string;
  branch: string;
  year: string;
  placement: ResultPlacement;
  scoreOrRemark: string;
  registrationId: string;
  published: boolean;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type AnnouncementCategory = 'General' | 'Event Update' | 'Schedule' | 'Result' | 'Urgent';
export type AnnouncementStatus = 'draft' | 'published' | 'archived';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  eventId: string;
  imageUrl?: string;
  status: AnnouncementStatus;
  publishAt: Timestamp;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: Timestamp;
}

export interface ClubHighlightItem {
  title: string;
  description: string;
}

export interface SectionVisibilitySettings {
  showHero3D: boolean;
  showMetrics: boolean;
  showEvents: boolean;
  showResults: boolean;
  showHighlights: boolean;
  showAnnouncements: boolean;
  showPhotoGallery?: boolean;
  showPortalCta: boolean;
}

export interface SiteSettings {
  clubName: string;
  institutionName: string;
  tagline: string;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroCtaLabel: string;
  showcaseTitle: string;
  showcaseSubtitle: string;
  aboutMissionTitle: string;
  aboutMissionBody: string;
  aboutHighlights: ClubHighlightItem[];
  certificateAuthorityTitle: string;
  certificateHeaderSubtitle: string;
  certificateFooterNote: string;
  sectionVisibility: SectionVisibilitySettings;
  contactEmail: string;
  contactPhone: string;
  campusAddress: string;
  facultyCoordinator: string;
  studentCoordinator: string;
  branches: string[];
  years: string[];
  privacyText: string;
  showPublicResults: boolean;
  updatedBy: string;
  updatedAt?: Timestamp;
}

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import type { AdminUser, SiteSettings } from '@/src/types/models';

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  clubName: 'GEC Khagaria Sports Club',
  institutionName: 'Government Engineering College, Khagaria',
  tagline: 'Official collegiate athletics, intramural tournaments, and student sports administration.',
  heroEyebrow: 'GEC Khagaria · Campus Sports & UMANG Arena',
  heroTitle: 'Play Bold. Compete Hard. Rise as Campus Champions.',
  heroSubtitle:
    'Jump into live campus tournaments, build solo or branch squads, track verified match results, and claim your official championship certificates.',
  heroCtaLabel: 'Explore Events',
  showcaseTitle: 'Live Championship Spotlight',
  showcaseSubtitle:
    'Follow live admin-published tournaments, active deadlines, venues, and open disciplines at GEC Khagaria.',
  aboutMissionTitle: 'Mission, Campus Facilities & Governance',
  aboutMissionBody:
    'The Sports Club of Government Engineering College, Khagaria coordinates campus-wide annual sports fests, inter-departmental leagues, selection trials, and athletic training programs. Every tournament, fixture progress update, published result, and digital certificate is managed directly by club faculty and student coordinators.',
  aboutHighlights: [
    {
      title: 'Multi-Event Tournament Structure',
      description:
        'Supports flagship fests like UMANG alongside seasonal inter-branch leagues with dedicated rules, quotas, and custom entry forms.',
    },
    {
      title: 'Fair & Enrollment-Verified Entries',
      description:
        'Unique enrollment locks and squad roster validation ensure fair competition across individual, doubles, and team sports.',
    },
    {
      title: 'Live Results & Official Certificates',
      description:
        'Verified match outcomes are published to the Results Panel, and students can download official club-issued certificates from their portal.',
    },
    {
      title: 'Student Multi-Game Hub',
      description:
        'Students participating across multiple events or multiple games can track every registration, team assignment, and fixture from one place.',
    },
  ],
  certificateAuthorityTitle: 'Faculty In-Charge, Sports Club',
  certificateHeaderSubtitle: 'Official Recognition of Athletic Excellence & Participation',
  certificateFooterNote:
    'Verified digital record issued by the Sports Club Administration, Government Engineering College, Khagaria.',
  sectionVisibility: {
    showHero3D: true,
    showMetrics: true,
    showEvents: true,
    showResults: true,
    showHighlights: true,
    showAnnouncements: true,
    showPhotoGallery: true,
    showPortalCta: true,
  },
  contactEmail: 'sportsclub@geckhagaria.ac.in',
  contactPhone: '+91 00000 00000',
  campusAddress: 'Government Engineering College, Khagaria, Bihar',
  facultyCoordinator: 'Faculty Sports Coordinator',
  studentCoordinator: 'Student Sports Secretary',
  branches: ['CSE (IoT)', 'Civil', 'Electrical', 'Mechanical'],
  years: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
  privacyText:
    'Student registration details (name, enrollment number, branch, year, phone, and email) are collected solely for organizing Government Engineering College, Khagaria Sports Club events, verifying participant eligibility, scheduling fixtures, publishing tournament results, and issuing official certificates.',
  showPublicResults: true,
  updatedBy: 'system',
};

export async function getSiteSettings(): Promise<SiteSettings> {
  const path = 'siteSettings/general';
  try {
    const snap = await getDoc(doc(db, 'siteSettings', 'general'));
    if (!snap.exists()) {
      return DEFAULT_SITE_SETTINGS;
    }
    const raw = snap.data() as Partial<SiteSettings>;
    return {
      ...DEFAULT_SITE_SETTINGS,
      ...raw,
      aboutHighlights:
        Array.isArray(raw.aboutHighlights) && raw.aboutHighlights.length > 0
          ? raw.aboutHighlights
          : DEFAULT_SITE_SETTINGS.aboutHighlights,
      sectionVisibility: {
        ...DEFAULT_SITE_SETTINGS.sectionVisibility,
        ...(raw.sectionVisibility || {}),
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveSiteSettings(
  settings: Omit<SiteSettings, 'updatedAt' | 'updatedBy'>,
  actor: AdminUser
): Promise<void> {
  const path = 'siteSettings/general';
  try {
    await setDoc(doc(db, 'siteSettings', 'general'), {
      ...settings,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog({
      actor,
      action: 'settings.update',
      entityType: 'settings',
      entityId: 'general',
      summary: 'Updated global Sports Club CMS settings, sections, certificates, and branch/year lists',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

# Security Specification & Threat Model — GEC Khagaria Sports Club

## 1. Data Invariants

1. **Public PII Isolation**: `/registrations` and `/studentProfiles` contain student contact details and academic identifiers. Unauthenticated visitors and peer students MUST NEVER be able to `list` `/studentProfiles` or `get`/`list` another student's `/registrations`.
2. **Scoped Admin Access**: Only active records in `/admins/{uid}` (or the bootstrapped super admin email with `email_verified == true`) have administrative privileges. `event_admin` and `coordinator` roles can ONLY read/update registrations, photos, and certificates for events in their `assignedEventIds`.
3. **No Self-Privilege Escalation**: Users CANNOT create or modify `/admins/{uid}` to grant themselves `super_admin` or arbitrary roles, nor can they alter `studentProfiles/{uid}` to access peer data.
4. **Master Gate on Event & Game State**: Public visitors can only read events in `['published', 'registration_open', 'registration_closed', 'ongoing', 'completed']`, games whose parent event is publicly visible AND `registrationStatus` in `['open', 'closed']`, and event photos with `published == true`.
5. **Atomic Duplicate & Capacity Guard**: Public registration creation requires `registrationStatus` matching the parent event's `autoApprove` setting, `declarationAccepted == true`, parent event `status == 'registration_open'`, parent game `registrationStatus == 'open'`, server timestamps (`request.time`), and atomic creation of `/registrationLookups/{lookupKey}`, `/studentPortals/{portalKey}/entries/{id}`, and `/registrationLocks/{lockId}`.
6. **Student Academic Profile & Certificate Ownership**: Students can create/update ONLY their own `/studentProfiles/{request.auth.uid}` (matching verified email). Only event-authorized admins can create, update, or delete `/issuedCertificates/{certId}` and `/certificateIndexes/{regNoHash}/items/{certId}`. Students can list `/issuedCertificates` ONLY with `studentUid == request.auth.uid`, and can read `/certificateIndexes/{regNoHash}/items` ONLY when authenticated with a verified email using their own SHA-256 `regNoHash`.
7. **Append-Only Audit & Status History**: `/auditLogs` and `/registrations/{id}/statusHistory` cannot be modified or deleted by any client.
8. **Payload Size & Image Bounds**: Any uploaded compressed image (`bannerUrl`, `imageUrl`, `customImageUrl`) is bounded to `<= 450000` characters (`< 450KB`), preventing oversized document denial-of-wallet attacks.

---

## 2. The "Dirty Dozen" Attack Payloads

1. **Unauthenticated Registration Read**: Public visitor attempts `getDoc` or `getDocs` on `/registrations`. -> MUST return `PERMISSION_DENIED`.
2. **Student Profile Directory Scraping**: Logged-in student attempts `getDocs(collection(db, 'studentProfiles'))` or `getDoc(/studentProfiles/otherUid)`. -> MUST return `PERMISSION_DENIED`.
3. **Student Forged Certificate Creation**: Logged-in student attempts `setDoc(/issuedCertificates/fakeCert, { studentUid: myUid, certificateType: 'winner', ... })`. -> MUST return `PERMISSION_DENIED`.
4. **Unverified Email Admin Spoof**: User with `email_verified: false` claiming admin email attempts to read `/registrations` or write `/events` or `/eventPhotos`. -> MUST return `PERMISSION_DENIED`.
5. **Self-Assigned Super Admin**: Authenticated non-admin attempts `setDoc(/admins/attackerUid, { role: 'super_admin', active: true, ... })`. -> MUST return `PERMISSION_DENIED`.
6. **Shadow Field Injection on Student Profile or Photo**: User submits `studentProfiles/{uid}` with `isAdmin: true` or ghost key. -> MUST return `PERMISSION_DENIED`.
7. **Closed Event / Draft Game Registration**: Public registrant submits registration targeting an event with `status: 'draft'` or `status: 'registration_closed'`, or a game with `registrationStatus: 'closed'`. -> MUST return `PERMISSION_DENIED`.
8. **Timestamp Forgery**: Client submits `createdAt: Timestamp.fromMillis(0)` instead of `serverTimestamp()` (`request.time`). -> MUST return `PERMISSION_DENIED`.
9. **Cross-Event Escalation**: An `event_admin` assigned only to `event_A` attempts to upload `/eventPhotos` or issue `/issuedCertificates` for `event_B`. -> MUST return `PERMISSION_DENIED`.
10. **Unpublished Photo Scraping**: Public visitor queries `eventPhotos` without filtering `published == true`. -> MUST return `PERMISSION_DENIED`.
11. **Oversized Base64 Poisoning (Denial of Wallet)**: Attacker uploads a 900KB `customImageUrl` or `imageUrl` (`> 450000` chars). -> MUST return `PERMISSION_DENIED`.
12. **Certificate List Scraping**: Logged-in student queries `/issuedCertificates` without `where('studentUid', '==', auth.uid)`. -> MUST return `PERMISSION_DENIED`.

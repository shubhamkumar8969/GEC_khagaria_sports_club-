# Sports Club Management Website — Government Engineering College, Khagaria

Official Firebase-connected Sports Club Management platform built with React, Vite, TypeScript, Tailwind CSS, Cloud Firestore, and Firebase Authentication.

## Core Capabilities

- **Public Sports Portal**: Homepage, About, Events directory, Event & Game details, Individual/Doubles/Team online registration, private Registration Reference lookup, Announcements, and Contact page.
- **Multi-Event & Multi-Game Engine**: Create unlimited events (e.g., UMANG'27) with configurable lifecycles (`draft`, `published`, `registration_open`, `registration_closed`, `ongoing`, `completed`, `archived`), duplicate configurations, and add any number of games with custom form builders.
- **Dynamic Registration & Duplicate Guard**: Atomic Firestore transactions validate event/game open status, registration windows, capacity limits, team size bounds, and deterministic uniqueness locks (`/registrationLocks`) to prevent duplicate entries.
- **Role-Based Admin Console**:
  - `super_admin`: Full management access, admin invitations, role assignments, site settings, audit logs, and starter data seeder.
  - `event_admin`: Scoped access to assigned events, game configuration, participant approval/rejection/waitlisting, and exports.
  - `coordinator`: Scoped access to assigned events for match progress & selection tracking with masked student phone/email PII.
- **Excel & CSV Exports**: Generates 4-sheet `.xlsx` workbooks (`Registrations`, `Team Members`, `Summary`, `Custom Answers`) and `.csv` files with spreadsheet formula-injection escaping and audit logging.

## Architecture & Security

- `firebase-blueprint.json`: Intermediate schema representation of all Firestore collections.
- `firestore.rules`: Hardened security rules enforcing RBAC, PII isolation on `/registrations`, non-enumerable SHA-256 registration lookups (`/registrationLookups`), server timestamps, and append-only `/auditLogs` and `statusHistory`.
- `firestore.indexes.json`: Composite query indexes for filtered event, registration, and announcement queries.
- `security_spec.md` & `firestore.rules.test.ts`: Threat model and "Dirty Dozen" security test cases.

## Getting Started

1. **Firebase Project Config**: Configured in `firebase-applet-config.json`.
2. **Administrator Bootstrap**:
   - Navigate to `/admin/login` and sign in with Google using the bootstrapped Super Admin account (`shubhamchaurasiya29129@gmail.com`).
   - Open **Admin → Site Settings** to update official club contact information, branch/year lists, or optionally click **Seed UMANG'27 Sample** to populate an initial event with 6 sports and notices.
   - Open **Admin → Admin Users** to invite additional `event_admin` or `coordinator` Google accounts and assign them to specific events.
3. **Verify Security Rules**:
   ```bash
   npx eslint firestore.rules
   ```
4. **Build & Typecheck**:
   ```bash
   npm run lint
   npm run build
   ```

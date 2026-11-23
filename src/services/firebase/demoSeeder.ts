import { doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './config';
import { writeAuditLog } from './audit';
import { DEFAULT_SITE_SETTINGS } from './settings';
import type { AdminUser, CustomFieldDefinition } from '@/src/types/models';

export async function seedDemoUmang27(actor: AdminUser): Promise<string> {
  const eventId = 'umang_27';
  const now = new Date();
  const regStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const regEnd = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
  const eventStart = new Date(now.getTime() + 50 * 24 * 60 * 60 * 1000);
  const eventEnd = new Date(now.getTime() + 55 * 24 * 60 * 60 * 1000);

  try {
    const batch = writeBatch(db);
    const tsNow = serverTimestamp();

    batch.set(doc(db, 'siteSettings', 'general'), {
      ...DEFAULT_SITE_SETTINGS,
      updatedBy: actor.uid,
      updatedAt: tsNow,
    });

    batch.set(doc(db, 'events', eventId), {
      name: "UMANG'27",
      slug: 'umang-27',
      shortDescription:
        'Annual Inter-Departmental Sports Fest of Government Engineering College, Khagaria featuring outdoor, indoor, and athletics disciplines.',
      description:
        "UMANG'27 is the flagship annual sports championship of Government Engineering College, Khagaria. Students from all branches and academic years compete across team tournaments, doubles events, and individual track and board competitions. Review individual game rules carefully before submitting your squad or solo entry.",
      bannerUrl: '',
      venue: 'GEC Khagaria Main Sports Ground & Indoor Complex',
      startAt: Timestamp.fromDate(eventStart),
      endAt: Timestamp.fromDate(eventEnd),
      registrationStartAt: Timestamp.fromDate(regStart),
      registrationEndAt: Timestamp.fromDate(regEnd),
      status: 'registration_open',
      featured: true,
      autoApprove: false,
      showPublicResults: true,
      createdBy: actor.uid,
      updatedBy: actor.uid,
      createdAt: tsNow,
      updatedAt: tsNow,
    });

    const games: Array<{
      id: string;
      name: string;
      category: 'Indoor' | 'Outdoor' | 'Athletics';
      participationType: 'individual' | 'doubles' | 'team';
      description: string;
      rules: string;
      maxParticipants: number;
      maxTeams: number;
      minTeamSize: number;
      maxTeamSize: number;
      eligibility: string;
      sortOrder: number;
      customFields: CustomFieldDefinition[];
    }> = [
      {
        id: 'umang27_cricket',
        name: 'Cricket',
        category: 'Outdoor',
        participationType: 'team',
        description: 'Inter-branch leather/tennis-ball knockout cricket tournament (12 overs per innings).',
        rules:
          'Standard college knockout rules apply. All players must carry valid college ID cards at toss time. Minimum 11 players and up to 15 squad members.',
        maxParticipants: 0,
        maxTeams: 16,
        minTeamSize: 11,
        maxTeamSize: 15,
        eligibility: 'Open to all regular B.Tech students of GEC Khagaria',
        sortOrder: 1,
        customFields: [
          {
            id: 'cf_cricket_role',
            label: 'Captain Primary Playing Role',
            type: 'dropdown',
            required: true,
            helpText: 'Select primary role in the team',
            options: ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'],
            filterable: true,
            order: 1,
          },
          {
            id: 'cf_cricket_kit',
            label: 'Does your team have personal batting gear?',
            type: 'single_choice',
            required: true,
            helpText: 'Club provides match balls and stumps; personal pads/gloves optional.',
            options: ['Yes, full gear', 'Partial gear', 'Need club kit'],
            filterable: false,
            order: 2,
          },
        ],
      },
      {
        id: 'umang27_volleyball',
        name: 'Volleyball',
        category: 'Outdoor',
        participationType: 'team',
        description: 'Best-of-3 sets inter-departmental volleyball championship.',
        rules: '6 active players on court + up to 4 substitutes. Rally point scoring (25 points per set).',
        maxParticipants: 0,
        maxTeams: 12,
        minTeamSize: 6,
        maxTeamSize: 10,
        eligibility: 'Open to all branches (1st to 4th Year)',
        sortOrder: 2,
        customFields: [
          {
            id: 'cf_vb_captain_pos',
            label: 'Captain Preferred Court Position',
            type: 'dropdown',
            required: true,
            helpText: '',
            options: ['Setter', 'Outside Hitter', 'Middle Blocker', 'Libero', 'Opposite'],
            filterable: true,
            order: 1,
          },
        ],
      },
      {
        id: 'umang27_kabaddi',
        name: 'Kabaddi',
        category: 'Outdoor',
        participationType: 'team',
        description: 'High-intensity mat/ground Kabaddi tournament following standard Pro/University rules.',
        rules: '7 active players + up to 5 substitutes. Weight category check will be conducted on ground before fixtures.',
        maxParticipants: 0,
        maxTeams: 12,
        minTeamSize: 7,
        maxTeamSize: 12,
        eligibility: 'Open to GEC Khagaria students; sports shoes or barefoot on mat',
        sortOrder: 3,
        customFields: [
          {
            id: 'cf_kabaddi_spec',
            label: 'Captain Specialization',
            type: 'single_choice',
            required: true,
            helpText: '',
            options: ['Raider', 'Defender', 'All-Rounder'],
            filterable: true,
            order: 1,
          },
        ],
      },
      {
        id: 'umang27_football',
        name: 'Football',
        category: 'Outdoor',
        participationType: 'team',
        description: '9-a-side campus football knockout cup.',
        rules: '9 players on pitch + up to 5 rolling substitutes. Shin guards mandatory.',
        maxParticipants: 0,
        maxTeams: 12,
        minTeamSize: 9,
        maxTeamSize: 14,
        eligibility: 'Open to all enrolled students',
        sortOrder: 4,
        customFields: [
          {
            id: 'cf_fb_position',
            label: 'Preferred Playing Position',
            type: 'dropdown',
            required: true,
            helpText: '',
            options: ['Forward', 'Midfielder', 'Defender', 'Goalkeeper'],
            filterable: true,
            order: 1,
          },
        ],
      },
      {
        id: 'umang27_badminton_doubles',
        name: 'Badminton Doubles',
        category: 'Indoor',
        participationType: 'doubles',
        description: 'Indoor court doubles championship (21-point best of 3 games).',
        rules: 'Non-marking indoor shoes mandatory. Players must bring personal racquets; feather/nylon shuttles provided for matches.',
        maxParticipants: 0,
        maxTeams: 24,
        minTeamSize: 2,
        maxTeamSize: 2,
        eligibility: 'Pair of 2 students (same or mixed branch allowed)',
        sortOrder: 5,
        customFields: [
          {
            id: 'cf_badminton_category',
            label: 'Division Category',
            type: 'single_choice',
            required: true,
            helpText: '',
            options: ["Men's Doubles", "Women's Doubles", 'Mixed Doubles'],
            filterable: true,
            order: 1,
          },
        ],
      },
      {
        id: 'umang27_chess',
        name: 'Chess',
        category: 'Indoor',
        participationType: 'individual',
        description: 'Swiss-league rapid chess championship (15+10 time control).',
        rules: 'FIDE rapid rules apply. Touch-move strictly enforced. 5 Swiss rounds followed by top-4 knockout.',
        maxParticipants: 64,
        maxTeams: 0,
        minTeamSize: 1,
        maxTeamSize: 1,
        eligibility: 'Open individual entry for all GEC Khagaria students',
        sortOrder: 6,
        customFields: [
          {
            id: 'cf_chess_rating',
            label: 'Chess.com / Lichess / FIDE Rating (Optional)',
            type: 'short_text',
            required: false,
            helpText: 'Mention rating or "Unrated" for Swiss seeding reference.',
            options: [],
            filterable: false,
            order: 1,
          },
        ],
      },
    ];

    for (const g of games) {
      batch.set(doc(db, 'events', eventId, 'games', g.id), {
        eventId,
        name: g.name,
        category: g.category,
        participationType: g.participationType,
        description: g.description,
        rules: g.rules,
        maxParticipants: g.maxParticipants,
        maxTeams: g.maxTeams,
        minTeamSize: g.minTeamSize,
        maxTeamSize: g.maxTeamSize,
        registrationDeadline: Timestamp.fromDate(regEnd),
        registrationStatus: 'open',
        eligibility: g.eligibility,
        sortOrder: g.sortOrder,
        customFields: g.customFields,
        createdAt: tsNow,
        updatedAt: tsNow,
      });
    }

    batch.set(doc(db, 'announcements', 'ann_umang27_open'), {
      title: "UMANG'27 Sports Fest Registrations Open",
      body: "Registrations are now open for UMANG'27 across Cricket, Volleyball, Kabaddi, Football, Badminton Doubles, and Chess. Captains and solo participants are advised to double-check enrollment numbers before submitting entries and save their Registration Reference ID for tracking.",
      category: 'Event Update',
      eventId,
      status: 'published',
      publishAt: tsNow,
      createdBy: actor.uid,
      createdByName: actor.displayName,
      createdAt: tsNow,
      updatedAt: tsNow,
    });

    batch.set(doc(db, 'announcements', 'ann_id_verification'), {
      title: 'Mandatory College ID Card Verification on Match Days',
      body: 'All approved participants and team squad members must present their original Government Engineering College, Khagaria student ID card at the reporting desk 30 minutes prior to scheduled fixtures.',
      category: 'General',
      eventId: '',
      status: 'published',
      publishAt: tsNow,
      createdBy: actor.uid,
      createdByName: actor.displayName,
      createdAt: tsNow,
      updatedAt: tsNow,
    });

    const sampleResults = [
      {
        id: 'res_umang27_chess_1',
        eventId,
        eventName: "UMANG'27",
        gameId: 'umang27_chess',
        gameName: 'Chess',
        category: 'Indoor',
        participationType: 'individual',
        winnerDisplayName: 'CSE (IoT) Rapid Board Champion (Sample Entry)',
        branch: 'CSE (IoT)',
        year: '3rd Year',
        placement: 'winner',
        scoreOrRemark: '5.0 / 5.0 Swiss Points',
        registrationId: '',
        published: true,
      },
      {
        id: 'res_umang27_cricket_1',
        eventId,
        eventName: "UMANG'27",
        gameId: 'umang27_cricket',
        gameName: 'Cricket',
        category: 'Outdoor',
        participationType: 'team',
        winnerDisplayName: 'Mechanical Warriors XI (Sample Entry)',
        branch: 'Mechanical',
        year: '4th Year',
        placement: 'winner',
        scoreOrRemark: 'Won Final by 18 runs',
        registrationId: '',
        published: true,
      },
      {
        id: 'res_umang27_badminton_2',
        eventId,
        eventName: "UMANG'27",
        gameId: 'umang27_badminton_doubles',
        gameName: 'Badminton Doubles',
        category: 'Indoor',
        participationType: 'doubles',
        winnerDisplayName: 'Electrical Shuttlers Pair (Sample Entry)',
        branch: 'Electrical',
        year: '2nd Year',
        placement: 'runner_up',
        scoreOrRemark: '19-21, 21-18, 18-21',
        registrationId: '',
        published: true,
      },
    ];

    for (const r of sampleResults) {
      batch.set(doc(db, 'publishedResults', r.id), {
        ...r,
        createdBy: actor.uid,
        createdAt: tsNow,
        updatedAt: tsNow,
      });
    }

    await batch.commit();

    await writeAuditLog({
      actor,
      action: 'seed.demo_umang27',
      entityType: 'event',
      entityId: eventId,
      summary: "Seeded UMANG'27 demo event with 6 games, announcements, sample results, and default site settings",
    });

    return eventId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `events/${eventId}`);
  }
}

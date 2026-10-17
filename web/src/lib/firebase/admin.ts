import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import { DemoCase, CaseActivity } from '@/types';

let adminApp: App | null = null;

export function isFirebaseAdminConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}

export function getFirebaseAdminApp(): App | null {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  try {
    // Correctly handle escaped newlines in multiline private keys
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1);
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    return adminApp;
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
}

export function getAdminFirestore(): Firestore | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getFirestore(app);
}

export function getAdminAuth(): Auth | null {
  const app = getFirebaseAdminApp();
  if (!app) return null;
  return getAuth(app);
}

// In-memory demo cases for local offline presentation testing
const inMemoryDemoCases: Map<string, DemoCase> = new Map([
  [
    'CASE-C01-001',
    {
      caseId: 'CASE-C01-001',
      fictionalClientId: 'C01',
      needCategory: 'shelter',
      status: 'action_plan_ready',
      assignedCoordinator: 'Elena Rostova (IHH Case Manager)',
      createdAt: '2026-10-17T09:00:00.000Z',
      updatedAt: '2026-10-17T10:30:00.000Z',
    },
  ],
]);

const inMemoryCaseActivities: CaseActivity[] = [
  {
    activityId: 'ACT-001',
    caseId: 'CASE-C01-001',
    actionType: 'resource_match',
    resourceId: '211-orange-county',
    status: 'completed',
    notes: 'Matched 211OC and Santa Ana Coordinated Entry access point for recuperative care exit.',
    timestamp: '2026-10-17T09:30:00.000Z',
  },
];

export async function fetchAllCases(): Promise<DemoCase[]> {
  const db = getAdminFirestore();
  if (!db) {
    // Return read-only in-memory demo records if Firestore is not configured
    return Array.from(inMemoryDemoCases.values());
  }

  const snapshot = await db.collection('demoCases').orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as DemoCase);
}

export async function fetchCaseById(caseId: string): Promise<DemoCase | null> {
  const db = getAdminFirestore();
  if (!db) {
    return inMemoryDemoCases.get(caseId) || null;
  }

  const doc = await db.collection('demoCases').doc(caseId).get();
  if (!doc.exists) return null;
  return doc.data() as DemoCase;
}

export async function createCaseRecord(data: Omit<DemoCase, 'caseId' | 'createdAt' | 'updatedAt'>): Promise<DemoCase> {
  const db = getAdminFirestore();
  const caseId = `CASE-${data.fictionalClientId}-${Date.now().toString().slice(-4)}`;
  const now = new Date().toISOString();

  const newCase: DemoCase = {
    ...data,
    caseId,
    createdAt: now,
    updatedAt: now,
  };

  if (!db) {
    inMemoryDemoCases.set(caseId, newCase);
    return newCase;
  }

  await db.collection('demoCases').doc(caseId).set(newCase);
  return newCase;
}

export async function updateCaseRecord(
  caseId: string,
  updates: Partial<Pick<DemoCase, 'status' | 'assignedCoordinator'>>
): Promise<DemoCase | null> {
  const db = getAdminFirestore();
  const now = new Date().toISOString();

  if (!db) {
    const existing = inMemoryDemoCases.get(caseId);
    if (!existing) return null;
    const updated: DemoCase = {
      ...existing,
      ...updates,
      updatedAt: now,
    };
    inMemoryDemoCases.set(caseId, updated);
    return updated;
  }

  const ref = db.collection('demoCases').doc(caseId);
  const doc = await ref.get();
  if (!doc.exists) return null;

  await ref.update({
    ...updates,
    updatedAt: now,
  });

  const updatedDoc = await ref.get();
  return updatedDoc.data() as DemoCase;
}

export async function logCaseActivity(activity: CaseActivity): Promise<void> {
  const db = getAdminFirestore();
  if (!db) {
    inMemoryCaseActivities.push(activity);
    return;
  }

  await db.collection('caseActivities').add(activity);
}

export async function fetchCaseActivities(caseId: string): Promise<CaseActivity[]> {
  const db = getAdminFirestore();
  if (!db) {
    return inMemoryCaseActivities.filter(a => a.caseId === caseId);
  }

  const snapshot = await db
    .collection('caseActivities')
    .where('caseId', '==', caseId)
    .orderBy('timestamp', 'desc')
    .get();

  return snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as CaseActivity);
}

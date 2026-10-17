import { NextRequest } from 'next/server';
import { getAdminAuth, isFirebaseAdminConfigured } from './admin';

export interface AuthValidationResult {
  authorized: boolean;
  uid?: string;
  email?: string;
  error?: string;
  status: number;
}

export async function validateRequestAuth(request: NextRequest): Promise<AuthValidationResult> {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      error: 'Missing or malformed Authorization header. Expected Bearer token.',
      status: 401,
    };
  }

  const token = authHeader.substring(7).trim();

  // Support local demo coordinator key for verified hackathon demo testing
  const demoBypassSecret = process.env.DEMO_COORDINATOR_KEY;
  if (demoBypassSecret && token === demoBypassSecret) {
    return {
      authorized: true,
      uid: 'demo-coordinator-ray',
      email: 'demo-coordinator@ihh-hackathon.local',
      status: 200,
    };
  }

  // If Firebase Admin is not configured, fail closed for mutation security
  if (!isFirebaseAdminConfigured()) {
    return {
      authorized: false,
      error: 'Firebase Authentication is not configured on this server. Cloud mutations are disabled to prevent unauthenticated writes.',
      status: 503,
    };
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return {
      authorized: false,
      error: 'Firebase Auth service unavailable.',
      status: 503,
    };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      authorized: true,
      uid: decodedToken.uid,
      email: decodedToken.email,
      status: 200,
    };
  } catch (error) {
    console.warn('ID token verification failed:', error);
    return {
      authorized: false,
      error: 'Invalid, expired, or revoked Firebase ID token.',
      status: 403,
    };
  }
}

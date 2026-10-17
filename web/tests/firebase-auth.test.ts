import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { validateRequestAuth } from '@/lib/firebase/auth';
import { isFirebaseAdminConfigured, getFirebaseAdminApp } from '@/lib/firebase/admin';

describe('Firebase Auth & Security Boundaries', () => {
  it('safe initialization: handles missing Firebase credentials without crashing', () => {
    // When credentials are not set, it should return false and not throw
    const configured = isFirebaseAdminConfigured();
    expect(typeof configured).toBe('boolean');
    const app = getFirebaseAdminApp();
    // In unconfigured environment, app should be null
    if (!configured) {
      expect(app).toBeNull();
    }
  });

  it('rejects unauthenticated requests to protected endpoints (fail-closed)', async () => {
    const req = new NextRequest('http://localhost:3000/api/cases', {
      method: 'GET',
    });

    const result = await validateRequestAuth(req);
    expect(result.authorized).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain('Authorization');
  });

  it('rejects invalid or forged bearer tokens', async () => {
    const req = new NextRequest('http://localhost:3000/api/cases', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid-token-12345',
      },
    });

    const result = await validateRequestAuth(req);
    expect(result.authorized).toBe(false);
    expect(result.status).toBeGreaterThanOrEqual(400);
  });
});

import { NextResponse } from 'next/server';
import { isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { isFirebaseClientConfigured } from '@/lib/firebase/client';


export async function GET() {
  const firebaseAdminReady = isFirebaseAdminConfigured();
  const firebaseClientReady = isFirebaseClientConfigured();
  const anthropicReady = Boolean(process.env.ANTHROPIC_API_KEY);

  return NextResponse.json({
    status: 'ok',
    service: 'resource-navigator',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    integrations: {
      firebase_admin: {
        configured: firebaseAdminReady,
        storage: firebaseAdminReady ? 'cloud-firestore' : 'in-memory-read-only',
      },
      firebase_client: {
        configured: firebaseClientReady,
      },
      claude_ai: {
        configured: anthropicReady,
        model: 'claude-3-5-sonnet-20241022',
        fallback: 'deterministic-rules-engine',
      },
    },
    capabilities: [
      'deterministic-c01-matching',
      'oc-resource-catalog',
      'confidential-address-masking',
      'action-plan-generation',
      'case-management-scaffold',
    ],
  });
}

/**
 * Health Check Endpoint
 *
 * Provides a simple health check for monitoring and Docker healthcheck.
 * No authentication required.
 *
 * Used by:
 * - Docker healthcheck (docker-compose.production.yml)
 * - Load balancers
 * - Monitoring systems
 * - Deploy scripts
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'ticketing-admin',
    },
    { status: 200 }
  );
}

/**
 * Supabase Admin Client (Server-Side Only)
 *
 * Provides a singleton Supabase client with service role key.
 * Uses lazy initialization to avoid evaluating SUPABASE_SERVICE_ROLE_KEY
 * during Next.js build time.
 *
 * CRITICAL:
 * - NEVER import/use this in client-side code
 * - Service role key bypasses Row Level Security (RLS)
 * - Only use in API routes and server-side functions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;

/**
 * Get or create Supabase admin client
 *
 * Uses lazy initialization - client is created on first call, not at import time.
 * This allows Next.js build to succeed without SUPABASE_SERVICE_ROLE_KEY present.
 *
 * @returns Supabase client with service role key
 * @throws Error if required environment variables are not configured
 */
export function getSupabaseAdmin(): SupabaseClient {
  // Return existing client if already initialized
  if (adminClient) {
    return adminClient;
  }

  // Read environment variables at runtime (not build time)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Validate required configuration
  if (!url) {
    throw new Error(
      '[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL is not configured on the server. ' +
      'This is required for server-side Supabase operations.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      '[Supabase Admin] SUPABASE_SERVICE_ROLE_KEY is not configured on the server. ' +
      'This is required for admin operations that bypass RLS. ' +
      'Verify that the environment variable is set in your deployment configuration.'
    );
  }

  // Create and cache admin client
  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Reset the admin client singleton (for testing purposes)
 * @internal
 */
export function resetSupabaseAdmin(): void {
  adminClient = null;
}

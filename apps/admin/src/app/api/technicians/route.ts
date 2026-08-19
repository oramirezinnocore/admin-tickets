import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { webcrypto } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Generate secure temporary password
 * 12 characters with uppercase, lowercase, numbers, and special characters
 */
function generateSecurePassword(): string {
  const length = 12;
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '@#$%&*!?';
  const allChars = uppercase + lowercase + numbers + special;

  // Ensure at least one of each required type
  const array = new Uint8Array(length);
  webcrypto.getRandomValues(array);

  let password = '';

  // Add one of each required character type
  password += uppercase[array[0] % uppercase.length];
  password += lowercase[array[1] % lowercase.length];
  password += numbers[array[2] % numbers.length];
  password += special[array[3] % special.length];

  // Fill remaining with random characters from all sets
  for (let i = 4; i < length; i++) {
    password += allChars[array[i] % allChars.length];
  }

  // Shuffle the password
  const passwordArray = password.split('');
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
}

export async function POST(request: NextRequest) {
  try {
    // Get user token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Validate configuration
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 });
    }

    // Create Supabase client with service role to validate token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Validate user token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Check if user is ADMIN
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 });
    }

    if (profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No tienes permisos para crear técnicos' }, { status: 403 });
    }

    if (!profile.is_active) {
      return NextResponse.json({ error: 'Usuario desactivado' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { full_name, email, phone, zone, vehicle } = body;

    // Validate required fields (password is no longer required)
    if (!full_name || !email) {
      return NextResponse.json(
        { error: 'full_name y email son obligatorios' },
        { status: 400 }
      );
    }

    // Generate secure temporary password
    const temporaryPassword = generateSecurePassword();

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name, phone },
    });

    if (createError || !newUser.user) {
      return NextResponse.json(
        { error: createError?.message || 'Error creating user' },
        { status: 400 }
      );
    }

    const userId = newUser.user.id;

    try {
      // Profile is created automatically by trigger
      // Wait a bit for trigger to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update profile with additional data and set must_change_password
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name,
          phone,
          email,
          must_change_password: true
        })
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('Profile update error:', profileUpdateError);
      }

      // Create technician record
      const { data: technicianData, error: technicianError } = await supabaseAdmin
        .from('technicians')
        .insert({
          profile_id: userId,
          zone: zone || null,
          vehicle: vehicle || null,
        })
        .select()
        .single();

      if (technicianError) {
        // Rollback: delete user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: 'Error creating technician: ' + technicianError.message },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        technician: {
          id: technicianData.id,
          profile_id: userId,
          email,
          full_name,
          phone,
          zone,
          vehicle,
        },
        temporaryPassword, // Return temporary password ONLY once
      });
    } catch (error: any) {
      // Rollback: delete user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw error;
    }
  } catch (error: any) {
    console.error('Error in POST /api/technicians:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    // Get user token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Validate user is ADMIN
    const supabaseClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if user is ADMIN
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { full_name, email, phone, password, zone, vehicle } = body;

    // Validate required fields
    if (!full_name || !email || !password) {
      return NextResponse.json(
        { error: 'full_name, email y password son obligatorios' },
        { status: 400 }
      );
    }

    // Create technician using service role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
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

      // Update profile with additional data
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ full_name, phone, email })
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

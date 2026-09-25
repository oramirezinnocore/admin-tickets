import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { webcrypto } from 'crypto';
import { UserRole } from '@wisper/shared';

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

/**
 * POST /api/personnel
 * Create new personnel (ADMIN, SUPPORT, or TECHNICIAN)
 *
 * Authorization:
 * - SUPER_ADMIN can create ADMIN, SUPPORT, TECHNICIAN
 * - ADMIN can create SUPPORT, TECHNICIAN (NOT ADMIN)
 * - Others: denied
 */
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

    // Create Supabase client with service role
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

    // Get caller profile
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 });
    }

    if (!callerProfile.is_active) {
      return NextResponse.json({ error: 'Usuario desactivado' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { full_name, email, phone, role, zone, vehicle } = body;

    // Validate required fields
    if (!full_name || !email || !role) {
      return NextResponse.json(
        { error: 'full_name, email y role son obligatorios' },
        { status: 400 }
      );
    }

    // Validate role value
    const validRoles = [UserRole.ADMIN, UserRole.SUPPORT, UserRole.TECHNICIAN];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser ADMIN, SUPPORT o TECHNICIAN' },
        { status: 400 }
      );
    }

    // Authorization check: Who can create which role?
    if (callerProfile.role === UserRole.SUPER_ADMIN) {
      // SUPER_ADMIN can create ADMIN, SUPPORT, TECHNICIAN
      // All allowed
    } else if (callerProfile.role === UserRole.ADMIN) {
      // ADMIN can create SUPPORT, TECHNICIAN (NOT ADMIN)
      if (role === UserRole.ADMIN) {
        return NextResponse.json(
          { error: 'No tienes permisos para crear administradores. Solo SUPER_ADMIN puede crear ADMIN.' },
          { status: 403 }
        );
      }
    } else {
      // SUPPORT, TECHNICIAN, others: denied
      return NextResponse.json(
        { error: 'No tienes permisos para crear personal' },
        { status: 403 }
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
      console.error('[Personnel] Error creating auth user:', createError);

      if (createError?.message?.includes('already exists') || createError?.message?.includes('already registered')) {
        return NextResponse.json(
          { error: 'Ya existe un usuario con este correo electrónico' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: createError?.message || 'Error al crear usuario' },
        { status: 400 }
      );
    }

    const userId = newUser.user.id;

    try {
      // Wait for trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update profile with role and data
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          role,
          full_name,
          phone: phone || null,
          email,
          must_change_password: true,
          is_active: true,
        })
        .eq('id', userId);

      if (profileUpdateError) {
        console.error('[Personnel] Profile update error:', profileUpdateError);
        // Rollback: delete user
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return NextResponse.json(
          { error: 'Error al configurar perfil' },
          { status: 500 }
        );
      }

      // If TECHNICIAN, create technician record
      if (role === UserRole.TECHNICIAN) {
        const { error: technicianError } = await supabaseAdmin
          .from('technicians')
          .insert({
            profile_id: userId,
            zone: zone || null,
            vehicle: vehicle || null,
            is_active: true,
          });

        if (technicianError) {
          console.error('[Personnel] Technician insert error:', technicianError);
          // Rollback: delete user
          await supabaseAdmin.auth.admin.deleteUser(userId);
          return NextResponse.json(
            { error: 'Error al crear registro de técnico: ' + technicianError.message },
            { status: 400 }
          );
        }
      }

      // Fetch created personnel
      const { data: personnel } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, email, phone, role, is_active, created_at')
        .eq('id', userId)
        .single();

      return NextResponse.json({
        success: true,
        personnel,
        temporaryPassword, // Return temporary password ONLY once
      });
    } catch (error: any) {
      // Rollback: delete user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw error;
    }
  } catch (error: any) {
    console.error('[Personnel] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/personnel
 * Update personnel or change role
 *
 * Authorization:
 * - SUPER_ADMIN can edit/transition all roles
 * - ADMIN can edit SUPPORT/TECHNICIAN (not ADMIN, not role changes to/from ADMIN)
 * - Others: denied
 */
export async function PATCH(request: NextRequest) {
  try {
    // Get user token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Get caller profile
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (profileError || !callerProfile) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 });
    }

    if (!callerProfile.is_active) {
      return NextResponse.json({ error: 'Usuario desactivado' }, { status: 403 });
    }

    // Authorization: Only SUPER_ADMIN and ADMIN can edit personnel
    if (callerProfile.role !== UserRole.SUPER_ADMIN && callerProfile.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'No tienes permisos para editar personal' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { id, full_name, phone, newRole, zone, vehicle } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Get target personnel
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('role, is_active')
      .eq('id', id)
      .single();

    if (targetError || !targetProfile) {
      return NextResponse.json({ error: 'Personal no encontrado' }, { status: 404 });
    }

    // Authorization checks for editing
    if (callerProfile.role === UserRole.ADMIN) {
      // ADMIN cannot edit other ADMIN or SUPER_ADMIN
      if (targetProfile.role === UserRole.ADMIN || targetProfile.role === UserRole.SUPER_ADMIN) {
        return NextResponse.json(
          { error: 'No tienes permisos para editar administradores' },
          { status: 403 }
        );
      }

      // ADMIN cannot change roles to/from ADMIN
      if (newRole && (newRole === UserRole.ADMIN || targetProfile.role === UserRole.ADMIN)) {
        return NextResponse.json(
          { error: 'No tienes permisos para crear o modificar administradores' },
          { status: 403 }
        );
      }
    }

    // Role transition logic
    if (newRole && newRole !== targetProfile.role) {
      // Validate newRole
      const validRoles = [UserRole.ADMIN, UserRole.SUPPORT, UserRole.TECHNICIAN];
      if (!validRoles.includes(newRole)) {
        return NextResponse.json(
          { error: 'Rol inválido' },
          { status: 400 }
        );
      }

      // Get existing technician record if any
      const { data: existingTechnician } = await supabaseAdmin
        .from('technicians')
        .select('*')
        .eq('profile_id', id)
        .single();

      // Check for active assigned tickets if transitioning FROM TECHNICIAN
      if (targetProfile.role === UserRole.TECHNICIAN && existingTechnician) {
        const { data: activeTickets, error: ticketsError } = await supabaseAdmin
          .from('tickets')
          .select('id')
          .eq('technician_id', existingTechnician.id)
          .in('status', ['PENDING', 'ASSIGNED', 'IN_REVIEW', 'PAUSED'])
          .limit(1);

        if (ticketsError) {
          return NextResponse.json(
            { error: 'Error al verificar tickets activos' },
            { status: 500 }
          );
        }

        if (activeTickets && activeTickets.length > 0) {
          return NextResponse.json(
            {
              error: 'No se puede cambiar el rol. El técnico tiene tickets activos sin cerrar. Cierra todos los tickets antes de cambiar el rol.'
            },
            { status: 409 }
          );
        }
      }

      // Handle role transitions
      if (newRole === UserRole.TECHNICIAN) {
        // Transitioning TO TECHNICIAN
        if (existingTechnician) {
          // Reactivate existing technician record
          const { error: reactivateError } = await supabaseAdmin
            .from('technicians')
            .update({
              is_active: true,
              zone: zone || existingTechnician.zone,
              vehicle: vehicle || existingTechnician.vehicle,
            })
            .eq('id', existingTechnician.id);

          if (reactivateError) {
            return NextResponse.json(
              { error: 'Error al reactivar técnico' },
              { status: 500 }
            );
          }
        } else {
          // Create new technician record
          const { error: createTechError } = await supabaseAdmin
            .from('technicians')
            .insert({
              profile_id: id,
              zone: zone || null,
              vehicle: vehicle || null,
              is_active: true,
            });

          if (createTechError) {
            return NextResponse.json(
              { error: 'Error al crear registro de técnico' },
              { status: 500 }
            );
          }
        }
      } else if (targetProfile.role === UserRole.TECHNICIAN && existingTechnician) {
        // Transitioning FROM TECHNICIAN to SUPPORT/ADMIN
        // Deactivate technician record (preserve history)
        const { error: deactivateError } = await supabaseAdmin
          .from('technicians')
          .update({ is_active: false })
          .eq('id', existingTechnician.id);

        if (deactivateError) {
          return NextResponse.json(
            { error: 'Error al desactivar registro de técnico' },
            { status: 500 }
          );
        }
      }

      // Update profile role
      const { error: roleUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ role: newRole })
        .eq('id', id);

      if (roleUpdateError) {
        return NextResponse.json(
          { error: 'Error al actualizar rol' },
          { status: 500 }
        );
      }
    }

    // Update profile data
    const updates: any = {};
    if (full_name !== undefined) updates.full_name = full_name;
    if (phone !== undefined) updates.phone = phone;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update(updates)
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { error: 'Error al actualizar perfil' },
          { status: 500 }
        );
      }
    }

    // Update technician fields if applicable
    const currentRole = newRole || targetProfile.role;
    if (currentRole === UserRole.TECHNICIAN && (zone !== undefined || vehicle !== undefined)) {
      const techUpdates: any = {};
      if (zone !== undefined) techUpdates.zone = zone;
      if (vehicle !== undefined) techUpdates.vehicle = vehicle;

      if (Object.keys(techUpdates).length > 0) {
        const { error: techUpdateError } = await supabaseAdmin
          .from('technicians')
          .update(techUpdates)
          .eq('profile_id', id);

        if (techUpdateError) {
          console.error('[Personnel] Error updating technician:', techUpdateError);
        }
      }
    }

    // Fetch updated personnel
    const { data: updatedPersonnel } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, phone, role, is_active, created_at, updated_at')
      .eq('id', id)
      .single();

    return NextResponse.json({
      success: true,
      personnel: updatedPersonnel,
    });
  } catch (error: any) {
    console.error('[Personnel] PATCH error:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

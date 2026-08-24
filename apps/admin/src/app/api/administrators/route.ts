import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@wisper/shared';
import { randomBytes } from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function generateSecurePassword(): string {
  // Generate 16-character password with letters and numbers
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(16);
  let password = '';
  for (let i = 0; i < 16; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verify SUPER_ADMIN role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'SUPER_ADMIN' || !profile.is_active) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Fetch all ADMIN and SUPER_ADMIN users (not TECHNICIAN)
    const { data: admins, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, is_active, created_at, updated_at')
      .in('role', ['ADMIN', 'SUPER_ADMIN'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Administrators] Error fetching admins:', error);
      return NextResponse.json({ error: 'Error al obtener administradores' }, { status: 500 });
    }

    return NextResponse.json({ administrators: admins || [] });
  } catch (error: any) {
    console.error('[Administrators] GET error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verify SUPER_ADMIN role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'SUPER_ADMIN' || !profile.is_active) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { fullName, email, phone } = body;

    if (!fullName || !email) {
      return NextResponse.json(
        { error: 'Nombre y correo son requeridos' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Correo electrónico inválido' }, { status: 400 });
    }

    // Generate secure temporary password
    const temporaryPassword = generateSecurePassword();

    // Create auth user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createError) {
      console.error('[Administrators] Error creating user:', createError);

      if (createError.message.includes('already exists') || createError.message.includes('already registered')) {
        return NextResponse.json(
          { error: 'Ya existe un usuario con este correo electrónico' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: 'Error al crear usuario: ' + createError.message },
        { status: 500 }
      );
    }

    const userId = newUser.user.id;

    console.log('[Administrators] User created:', userId);

    // Wait for trigger to create profile
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update profile to ADMIN role with must_change_password = true
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        role: 'ADMIN',
        full_name: fullName,
        phone: phone || null,
        must_change_password: true,
        is_active: true,
      })
      .eq('id', userId);

    if (profileError) {
      console.error('[Administrators] Error updating profile:', profileError);

      // Cleanup: delete auth user if profile update failed
      await supabase.auth.admin.deleteUser(userId);

      return NextResponse.json(
        { error: 'Error al configurar perfil del administrador' },
        { status: 500 }
      );
    }

    console.log('[Administrators] Profile updated to ADMIN');

    // Fetch the created administrator
    const { data: admin } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, is_active, created_at')
      .eq('id', userId)
      .single();

    return NextResponse.json({
      administrator: admin,
      temporaryPassword, // Only returned once!
    });
  } catch (error: any) {
    console.error('[Administrators] POST error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Validate authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    // Verify SUPER_ADMIN role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'SUPER_ADMIN' || !profile.is_active) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { id, fullName, phone, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    }

    // Prevent self-deactivation
    if (id === user.id && isActive === false) {
      return NextResponse.json(
        { error: 'Por seguridad, no puedes desactivar tu propia cuenta.' },
        { status: 409 }
      );
    }

    // Fetch target admin
    const { data: targetAdmin } = await supabase
      .from('profiles')
      .select('role, is_active')
      .eq('id', id)
      .single();

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Administrador no encontrado' }, { status: 404 });
    }

    // If deactivating a SUPER_ADMIN, check if it's the last one
    if (targetAdmin.role === 'SUPER_ADMIN' && isActive === false && targetAdmin.is_active === true) {
      const { data: activeSuperAdmins, error: countError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'SUPER_ADMIN')
        .eq('is_active', true);

      if (countError) {
        console.error('[Administrators] Error counting SUPER_ADMINs:', countError);
        return NextResponse.json(
          { error: 'Error al verificar superadministradores' },
          { status: 500 }
        );
      }

      if (activeSuperAdmins && activeSuperAdmins.length <= 1) {
        return NextResponse.json(
          { error: 'No puedes desactivar al último superadministrador activo.' },
          { status: 409 }
        );
      }
    }

    // Build update object
    const updates: any = {};
    if (fullName !== undefined) updates.full_name = fullName;
    if (phone !== undefined) updates.phone = phone;
    if (isActive !== undefined) updates.is_active = isActive;

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('[Administrators] Error updating admin:', updateError);
      return NextResponse.json({ error: 'Error al actualizar administrador' }, { status: 500 });
    }

    // Fetch updated admin
    const { data: updatedAdmin } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, is_active, created_at, updated_at')
      .eq('id', id)
      .single();

    return NextResponse.json({ administrator: updatedAdmin });
  } catch (error: any) {
    console.error('[Administrators] PATCH error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

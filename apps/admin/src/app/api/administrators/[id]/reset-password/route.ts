import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params;
    const targetUserId = resolvedParams.id;

    // Fetch target admin
    const { data: targetAdmin } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active')
      .eq('id', targetUserId)
      .single();

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Administrador no encontrado' }, { status: 404 });
    }

    // Only allow resetting ADMIN passwords (not SUPER_ADMIN)
    if (targetAdmin.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'No se puede restablecer la contraseña de un superadministrador' },
        { status: 403 }
      );
    }

    // Generate new temporary password
    const temporaryPassword = generateSecurePassword();

    // Update password in Supabase Auth
    const { error: authError } = await supabase.auth.admin.updateUserById(targetUserId, {
      password: temporaryPassword,
    });

    if (authError) {
      console.error('[ResetPassword] Error updating auth password:', authError);
      return NextResponse.json(
        { error: 'Error al actualizar la contraseña' },
        { status: 500 }
      );
    }

    // Update must_change_password in profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', targetUserId);

    if (profileError) {
      console.error('[ResetPassword] Error updating profile:', profileError);
      return NextResponse.json(
        { error: 'Error al configurar cambio de contraseña' },
        { status: 500 }
      );
    }

    console.log('[ResetPassword] Success for user:', targetUserId);

    return NextResponse.json({
      temporaryPassword, // Only returned once!
      email: targetAdmin.email,
    });
  } catch (error: any) {
    console.error('[ResetPassword] Error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

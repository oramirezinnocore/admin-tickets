'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';
import { UserRole, getTicketSlaState, TicketSlaState, isAnyAdmin, canManageAdministrators } from '@wisper/shared';
import { supabase } from '@/lib/supabase';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user || !profile) {
        router.push('/login');
      } else if (!isAnyAdmin(profile.role)) {
        signOut().then(() => {
          router.push('/login');
        });
      }
    }
  }, [user, profile, loading, router, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!user || !profile || !isAnyAdmin(profile.role)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}

function Header() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    loadCriticalCount();

    const interval = setInterval(() => {
      loadCriticalCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  async function loadCriticalCount() {
    try {
      const { data: tickets } = await supabase
        .from('tickets')
        .select('created_at, status')
        .in('status', ['PENDING', 'ASSIGNED', 'IN_REVIEW', 'PAUSED']);

      if (!tickets) return;

      const critical = tickets.filter(t => {
        const sla = getTicketSlaState(t.created_at);
        return sla === TicketSlaState.OVERDUE || sla === TicketSlaState.RED;
      });

      setCriticalCount(critical.length);
    } catch (error) {
      console.error('Error loading critical count:', error);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const navLinks = [
    { href: '/dashboard', label: 'Inicio' },
    { href: '/tickets', label: 'Tickets', badge: criticalCount > 0 ? criticalCount : undefined },
    { href: '/clients', label: 'Clientes' },
    { href: '/technicians', label: 'Técnicos' },
    { href: '/map', label: 'Mapa' },
  ];

  // Add Administrators link only for SUPER_ADMIN
  if (profile && canManageAdministrators(profile.role)) {
    navLinks.push({ href: '/administrators', label: 'Administradores' });
  }

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top bar */}
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-3">
            <img
              src="/branding/wisper-logo.png"
              alt="Wisper Logística"
              className="h-8 w-auto"
            />
            <div className="border-l border-gray-300 pl-3">
              <p className="text-xs text-gray-600 font-medium">Panel administrativo</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* User info */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ backgroundColor: 'var(--wisper-blue)' }}>
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500">
                  {profile?.role === UserRole.SUPER_ADMIN ? 'Super Administrador' : 'Administrador'}
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={handleSignOut}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium"
              title="Cerrar sesión"
            >
              Salir
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex gap-1 -mb-px" role="navigation">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                pathname === link.href
                  ? 'text-blue-600 hover:text-gray-900 hover:border-gray-300'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
              style={pathname === link.href ? { borderColor: 'var(--wisper-blue)', color: 'var(--wisper-blue)' } : undefined}
            >
              {link.label}
              {link.badge !== undefined && link.badge > 0 && (
                <span className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" style={{ backgroundColor: 'var(--wisper-red)' }}>
                  {link.badge > 9 ? '9+' : link.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

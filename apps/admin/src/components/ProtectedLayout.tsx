'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { UserRole, getTicketSlaState, TicketSlaState } from '@wisper/shared';
import { supabase } from '@/lib/supabase';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (!user || !profile) {
        router.push('/login');
      } else if (profile.role !== UserRole.ADMIN) {
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

  if (!user || !profile || profile.role !== UserRole.ADMIN) {
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
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/tickets', label: 'Tickets', badge: criticalCount > 0 ? criticalCount : undefined },
    { href: '/clients', label: 'Clientes' },
    { href: '/technicians', label: 'Técnicos' },
    { href: '/map', label: 'Mapa' },
  ];

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4 border-b">
          <h1 className="text-2xl font-bold text-gray-900">Wisper Logística</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{profile?.full_name}</span>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
        <nav className="flex gap-1 py-2">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`relative px-4 py-2 rounded-md text-sm font-medium transition ${
                pathname === link.href
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {link.label}
              {link.badge !== undefined && link.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
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

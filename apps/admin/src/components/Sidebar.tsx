'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { canManageAdministrators } from '@wisper/shared';
import { getTicketSlaState, TicketSlaState } from '@wisper/shared';
import { supabase } from '@/lib/supabase';
import {
  Home,
  Ticket,
  Users,
  UserCog,
  MapPin,
  BarChart3,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  roles?: string[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [criticalCount, setCriticalCount] = useState(0);

  useEffect(() => {
    loadCriticalCount();
    const interval = setInterval(loadCriticalCount, 30000);
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

  const navItems: NavItem[] = [
    { href: '/dashboard', label: 'Inicio', icon: Home },
    { href: '/tickets', label: 'Tickets', icon: Ticket, badge: criticalCount },
    { href: '/clients', label: 'Clientes', icon: Users },
    { href: '/technicians', label: 'Personal', icon: UserCog },
    { href: '/map', label: 'Mapa', icon: MapPin },
    { href: '/reports', label: 'Reportes', icon: BarChart3 },
  ];

  // Add admin-only items
  if (profile && canManageAdministrators(profile.role)) {
    navItems.push(
      { href: '/administrators', label: 'Administradores', icon: Shield },
      { href: '/settings/office', label: 'Configuración', icon: Settings }
    );
  }

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  async function handleSignOut() {
    await signOut();
    window.location.href = '/login';
  }

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-40 flex flex-col ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Header with Logo */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 h-16">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <img
              src="/branding/wisper-logo.png"
              alt="Wisper"
              className="h-8 w-auto transition-opacity group-hover:opacity-80"
            />
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <img
              src="/branding/wisper-logo.png"
              alt="Wisper"
              className="h-8 w-auto"
            />
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all group relative ${
                    active
                      ? 'text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  style={active ? { backgroundColor: 'var(--wisper-blue)' } : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'}`} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className="text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-2"
                          style={{ backgroundColor: 'var(--wisper-red)' }}
                        >
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </>
                  )}
                  {collapsed && item.badge !== undefined && item.badge > 0 && (
                    <span
                      className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                      style={{ backgroundColor: 'var(--wisper-red)' }}
                    >
                      {item.badge > 9 ? '9' : item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="border-t border-gray-200 p-4">
        {!collapsed ? (
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
              style={{ backgroundColor: 'var(--wisper-blue)' }}
            >
              {profile?.full_name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile?.full_name}</p>
              <p className="text-xs text-gray-500 truncate">
                {profile?.role === 'SUPER_ADMIN' ? 'Super Admin' :
                 profile?.role === 'SUPPORT' ? 'Soporte' : 'Administrador'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
              style={{ backgroundColor: 'var(--wisper-blue)' }}
              title={profile?.full_name}
            >
              {profile?.full_name?.charAt(0) || 'A'}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title={collapsed ? 'Expandir' : 'Contraer'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>Contraer</span>}
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

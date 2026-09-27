'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { canAccessBackOffice } from '@wisper/shared';
import Sidebar from '@/components/Sidebar';
import CommandPalette from '@/components/CommandPalette';
import { useCommandPalette } from '@/hooks/useCommandPalette';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, profile, loading, signOut } = useAuth();
  const { isOpen, setIsOpen } = useCommandPalette();

  useEffect(() => {
    if (!loading) {
      if (!user || !profile) {
        router.push('/login');
      } else if (!canAccessBackOffice(profile.role)) {
        signOut().then(() => {
          router.push('/login');
        });
      }
    }
  }, [user, profile, loading, router, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!user || !profile || !canAccessBackOffice(profile.role)) {
    return null;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <Sidebar />
      <main className="ml-64 p-8">
        <div className="max-w-[1400px] mx-auto">
          {children}
        </div>
      </main>
      <CommandPalette isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </div>
  );
}

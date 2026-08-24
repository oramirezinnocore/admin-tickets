'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile, isAnyAdmin } from '@wisper/shared';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!data) {
        console.error('Profile not found for user:', userId);
        setProfile(null);
        setLoading(false);
        return;
      }

      setProfile(data as Profile);
    } catch (error) {
      console.error('Unexpected error loading profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile() {
    if (user) {
      await loadProfile(user.id);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        return { error: error.message };
      }

      if (!data.user) {
        setLoading(false);
        return { error: 'No user returned from login' };
      }

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        setLoading(false);
        return { error: 'Profile not found. Please contact support.' };
      }

      // Check if user is ADMIN or SUPER_ADMIN
      if (!isAnyAdmin(profileData.role)) {
        await supabase.auth.signOut();
        setLoading(false);
        return { error: 'Este usuario no tiene acceso al panel administrativo.' };
      }

      // Check if user is active
      if (!profileData.is_active) {
        await supabase.auth.signOut();
        setLoading(false);
        return { error: 'Tu cuenta está desactivada. Contacta al superadministrador.' };
      }

      setProfile(profileData as Profile);
      setUser(data.user);
      setLoading(false);
      return { error: null };
    } catch (error) {
      setLoading(false);
      return { error: 'Error inesperado al iniciar sesión' };
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }

  // Redirect logic for must_change_password and is_active
  useEffect(() => {
    if (loading || !user || !profile) return;

    // Check if user became inactive
    if (!profile.is_active) {
      signOut().then(() => {
        router.push('/login');
      });
      return;
    }

    // Skip redirect if already on /change-password or /login
    if (pathname === '/change-password' || pathname === '/login') {
      return;
    }

    // Redirect to change password if needed
    if (profile.must_change_password) {
      router.push('/change-password');
    }
  }, [profile, loading, user, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

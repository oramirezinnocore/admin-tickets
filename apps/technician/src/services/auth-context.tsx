import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { Alert } from 'react-native';
import { supabase } from './supabase';
import { Profile, UserRole } from '@wisper/shared';
import { registerForPushNotificationsAsync, deactivatePushToken } from './push-notifications';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  technicianId: string | null;
  loading: boolean;
  mustChangePassword: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [technicianId, setTechnicianId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

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
        setTechnicianId(null);
        setLoading(false);
        return;
      }

      if (!data) {
        console.error('Profile not found for user:', userId);
        setProfile(null);
        setTechnicianId(null);
        setLoading(false);
        return;
      }

      const profileData = data as Profile;
      setProfile(profileData);
      setMustChangePassword(profileData.must_change_password || false);

      // Get technician ID
      const { data: techData } = await supabase
        .from('technicians')
        .select('id')
        .eq('profile_id', userId)
        .single();

      if (techData) {
        setTechnicianId(techData.id);

        // Register push token (non-blocking)
        registerForPushNotificationsAsync(techData.id).then((result) => {
          if (!result.success) {
            console.warn('[Auth] Push notification setup failed:', result.error);
            // Don't block login if push fails
          }
        });
      }
    } catch (error) {
      console.error('Unexpected error loading profile:', error);
      setProfile(null);
      setTechnicianId(null);
      setMustChangePassword(false);
    } finally {
      setLoading(false);
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
        return { error: 'No se pudo iniciar sesión' };
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
        return { error: 'Perfil no encontrado. Contacta a soporte.' };
      }

      // Check if user is TECHNICIAN
      if (profileData.role !== UserRole.TECHNICIAN) {
        await supabase.auth.signOut();
        setLoading(false);
        return { error: 'Este usuario no tiene acceso a la aplicación de técnicos.' };
      }

      // Check if user is active
      if (!profileData.is_active) {
        await supabase.auth.signOut();
        setLoading(false);
        return { error: 'Esta cuenta ha sido desactivada. Contacta al administrador.' };
      }

      const profile = profileData as Profile;
      setProfile(profile);
      setUser(data.user);
      setMustChangePassword(profile.must_change_password || false);
      setLoading(false);
      return { error: null };
    } catch (error) {
      setLoading(false);
      return { error: 'Error inesperado al iniciar sesión' };
    }
  }

  async function signOut() {
    // Deactivate push token
    if (technicianId) {
      await deactivatePushToken(technicianId);
    }

    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setTechnicianId(null);
    setMustChangePassword(false);
  }

  async function refreshProfile() {
    if (user) {
      await loadProfile(user.id);
    }
  }

  return (
    <AuthContext.Provider value={{ user, profile, technicianId, loading, mustChangePassword, signIn, signOut, refreshProfile }}>
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

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, ScrollView } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../services/auth-context';
import { useLocationTracker } from '../services/location-tracker';
import { supabase } from '../services/supabase';
import { getTicketSlaState, TicketSlaState } from '@wisper/shared';

export default function HomeScreen() {
  const navigation = useNavigation();
  const { profile, signOut } = useAuth();
  const { hasPermission } = useLocationTracker();
  const [stats, setStats] = useState({
    closedToday: 0,
    pending: 0,
    overdue: 0,
    criticalTickets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [technician, setTechnician] = useState<any>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadStats();
    }, [profile])
  );

  async function loadStats() {
    if (!profile) return;

    try {
      // Get technician record
      const { data: techData } = await supabase
        .from('technicians')
        .select('*')
        .eq('profile_id', profile.id)
        .single();

      setTechnician(techData);

      if (!techData) return;

      // Get all assigned tickets
      const { data: tickets } = await supabase
        .from('tickets')
        .select('*')
        .eq('technician_id', techData.id);

      if (!tickets) return;

      // Calculate stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const closedToday = tickets.filter(
        t => t.status === 'RESOLVED' &&
        t.closed_at &&
        new Date(t.closed_at) >= today
      ).length;

      const pending = tickets.filter(
        t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED'
      ).length;

      const overdue = tickets.filter(
        t => t.status !== 'RESOLVED' &&
        t.status !== 'CANCELLED' &&
        getTicketSlaState(t.created_at) === TicketSlaState.OVERDUE
      ).length;

      const activeTickets = tickets.filter(
        t => t.status !== 'RESOLVED' && t.status !== 'CANCELLED'
      );

      const criticalTickets = activeTickets.filter(t => {
        const sla = getTicketSlaState(t.created_at);
        return sla === TicketSlaState.OVERDUE || sla === TicketSlaState.RED;
      }).length;

      setStats({ closedToday, pending, overdue, criticalTickets });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadStats();
  }

  async function handleSignOut() {
    await signOut();
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Wisper Logística</Text>
        <Text style={styles.greeting}>Hola, {profile?.full_name}</Text>
        {technician?.zone && (
          <Text style={styles.zone}>Zona: {technician.zone}</Text>
        )}
        <View style={styles.locationStatus}>
          <View style={[styles.locationDot, hasPermission ? styles.locationActive : styles.locationInactive]} />
          <Text style={styles.locationText}>
            Ubicación: {hasPermission ? 'Activa' : 'Sin permiso'}
          </Text>
        </View>
        {!hasPermission && (
          <Text style={styles.locationHint}>
            Activa la ubicación para que el administrador pueda monitorear tus servicios.
          </Text>
        )}
      </View>

      {stats.criticalTickets > 0 && (
        <TouchableOpacity
          style={styles.criticalBanner}
          onPress={() => (navigation as any).navigate('Tickets')}
        >
          <Text style={styles.criticalBannerText}>
            ⚠️ Tienes {stats.criticalTickets} ticket{stats.criticalTickets > 1 ? 's' : ''} prioritario{stats.criticalTickets > 1 ? 's' : ''} por atender
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.closedToday}</Text>
          <Text style={styles.statLabel}>Tickets cerrados hoy</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Tickets pendientes</Text>
        </View>

        {stats.overdue > 0 && (
          <View style={[styles.statCard, styles.overdueCard]}>
            <Text style={[styles.statNumber, styles.overdueNumber]}>
              {stats.overdue}
            </Text>
            <Text style={styles.statLabel}>Tickets vencidos</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => (navigation as any).navigate('Tickets')}
      >
        <Text style={styles.buttonText}>Ver tickets</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 40,
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  greeting: {
    fontSize: 18,
    color: '#666',
  },
  zone: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  locationStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  locationActive: {
    backgroundColor: '#10B981',
  },
  locationInactive: {
    backgroundColor: '#9ca3af',
  },
  locationText: {
    fontSize: 13,
    color: '#6b7280',
  },
  locationHint: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 4,
  },
  statsContainer: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  statCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  overdueCard: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  overdueNumber: {
    color: '#DC2626',
  },
  statLabel: {
    fontSize: 16,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
    marginHorizontal: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  signOutText: {
    color: '#666',
    fontSize: 14,
  },
  criticalBanner: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 8,
  },
  criticalBannerText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
});

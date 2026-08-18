import React, { createContext, useContext, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from './supabase';
import { useAuth } from './auth-context';

interface LocationTrackerContextType {
  isTracking: boolean;
  hasPermission: boolean;
  lastLocation: Location.LocationObject | null;
}

const LocationTrackerContext = createContext<LocationTrackerContextType>({
  isTracking: false,
  hasPermission: false,
  lastLocation: null,
});

export function LocationTrackerProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [lastLocation, setLastLocation] = useState<Location.LocationObject | null>(null);
  const [lastInsertTime, setLastInsertTime] = useState<number>(0);
  const [lastInsertCoords, setLastInsertCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [technicianId, setTechnicianId] = useState<string | null>(null);

  useEffect(() => {
    if (user && profile?.role === 'TECHNICIAN' && profile?.is_active) {
      loadTechnicianId();
    } else {
      setTechnicianId(null);
      setIsTracking(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (technicianId) {
      startTracking();
    }

    return () => {
      setIsTracking(false);
    };
  }, [technicianId]);

  async function loadTechnicianId() {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('technicians')
        .select('id')
        .eq('profile_id', profile.id)
        .single();

      setTechnicianId(data?.id || null);
    } catch (error) {
      console.error('Error loading technician ID:', error);
    }
  }

  async function startTracking() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status !== 'granted') {
        console.log('Location permission not granted');
        return;
      }

      setIsTracking(true);

      // Watch position
      await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 60000, // 60 seconds
          distanceInterval: 50, // 50 meters
        },
        (location) => {
          setLastLocation(location);
          handleLocationUpdate(location);
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setIsTracking(false);
    }
  }

  async function handleLocationUpdate(location: Location.LocationObject) {
    if (!technicianId) return;

    const now = Date.now();
    const { latitude, longitude, accuracy } = location.coords;

    // Check if should insert
    const timeDiff = now - lastInsertTime;
    const shouldInsertTime = timeDiff >= 60000; // 60 seconds

    let shouldInsertDistance = false;
    if (lastInsertCoords) {
      const distance = getDistance(
        lastInsertCoords.lat,
        lastInsertCoords.lng,
        latitude,
        longitude
      );
      shouldInsertDistance = distance >= 50; // 50 meters
    }

    if (!lastInsertCoords || shouldInsertTime || shouldInsertDistance) {
      try {
        const { error } = await supabase.from('technician_locations').insert({
          technician_id: technicianId,
          latitude,
          longitude,
          accuracy: accuracy || null,
        });

        if (error) {
          console.warn('Error inserting location:', error);
        } else {
          setLastInsertTime(now);
          setLastInsertCoords({ lat: latitude, lng: longitude });
        }
      } catch (error) {
        console.warn('Failed to insert location:', error);
      }
    }
  }

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  return (
    <LocationTrackerContext.Provider value={{ isTracking, hasPermission, lastLocation }}>
      {children}
    </LocationTrackerContext.Provider>
  );
}

export function useLocationTracker() {
  return useContext(LocationTrackerContext);
}

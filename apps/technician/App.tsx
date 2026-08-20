import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './src/services/auth-context';
import { LocationTrackerProvider } from './src/services/location-tracker';
import { setupNotificationListeners, getLastNotificationResponse } from './src/services/push-notifications';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import TicketsScreen from './src/screens/TicketsScreen';
import TicketDetailScreen from './src/screens/TicketDetailScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';

const AuthStack = createNativeStackNavigator();
const AppStack = createNativeStackNavigator();
const PasswordStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
    </AuthStack.Navigator>
  );
}

function ChangePasswordNavigator() {
  return (
    <PasswordStack.Navigator>
      <PasswordStack.Screen
        name="ChangePassword"
        component={ChangePasswordScreen}
        options={{ headerShown: false }}
      />
    </PasswordStack.Navigator>
  );
}

function AppNavigator() {
  return (
    <AppStack.Navigator>
      <AppStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <AppStack.Screen name="Tickets" component={TicketsScreen} options={{ title: 'Tickets' }} />
      <AppStack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'Detalle del ticket' }} />
    </AppStack.Navigator>
  );
}

function RootNavigator() {
  const { user, loading, mustChangePassword } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // If user is logged in but must change password, show change password screen
  if (user && mustChangePassword) {
    return <ChangePasswordNavigator />;
  }

  return user ? <AppNavigator /> : <AuthNavigator />;
}

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const [pendingTicketId, setPendingTicketId] = useState<string | null>(null);

  useEffect(() => {
    // Setup notification listeners
    const unsubscribe = setupNotificationListeners(
      (notification) => {
        // Foreground notification received
        console.log('[App] Foreground notification:', notification);
      },
      (response) => {
        // Notification tapped
        console.log('[App] Notification tapped:', response);
        const ticketId = response.notification.request.content.data?.ticketId as string;
        if (ticketId) {
          handleNotificationNavigation(ticketId);
        }
      }
    );

    // Check for notification that opened the app
    getLastNotificationResponse().then((response) => {
      if (response) {
        console.log('[App] App opened from notification:', response);
        const ticketId = response.notification.request.content.data?.ticketId as string;
        if (ticketId) {
          setPendingTicketId(ticketId);
        }
      }
    });

    return unsubscribe;
  }, []);

  // Navigate to ticket when notification is tapped
  const handleNotificationNavigation = (ticketId: string) => {
    if (navigationRef.current?.isReady()) {
      navigationRef.current.navigate('TicketDetail', { ticketId });
    } else {
      setPendingTicketId(ticketId);
    }
  };

  // Handle pending navigation after navigation is ready
  useEffect(() => {
    if (pendingTicketId && navigationRef.current?.isReady()) {
      setTimeout(() => {
        navigationRef.current?.navigate('TicketDetail', { ticketId: pendingTicketId });
        setPendingTicketId(null);
      }, 500);
    }
  }, [pendingTicketId, navigationRef.current?.isReady()]);

  return (
    <AuthProvider>
      <LocationTrackerProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="auto" />
          <RootNavigator />
        </NavigationContainer>
      </LocationTrackerProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

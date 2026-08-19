import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/services/auth-context';
import { LocationTrackerProvider } from './src/services/location-tracker';
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
  return (
    <AuthProvider>
      <LocationTrackerProvider>
        <NavigationContainer>
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

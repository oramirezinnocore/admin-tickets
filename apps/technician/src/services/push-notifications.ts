import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Configure Android notification channel
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('tickets', {
    name: 'Tickets asignados',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#1F66A5',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  }).catch((error) => {
    console.warn('[Push] Error creating Android notification channel:', error);
  });
}

/**
 * Request notification permissions and register push token
 */
export async function registerForPushNotificationsAsync(
  technicianId: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    // Check if running on physical device
    if (!Device.isDevice) {
      return {
        success: false,
        error: 'Las notificaciones push solo funcionan en dispositivos físicos',
      };
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return {
        success: false,
        error: 'Permisos de notificaciones denegados',
      };
    }

    // Get push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    if (!projectId) {
      console.warn('[Push] No project ID found in config');
      return {
        success: false,
        error: 'Error de configuración: projectId no encontrado',
      };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const expoPushToken = tokenData.data;

    // Get device info
    const deviceName = Device.deviceName || undefined;
    const platform = Platform.OS;

    // Save token to database
    const { error: dbError } = await supabase
      .from('technician_push_tokens')
      .upsert(
        {
          technician_id: technicianId,
          expo_push_token: expoPushToken,
          platform,
          device_name: deviceName,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'technician_id,expo_push_token',
        }
      );

    if (dbError) {
      console.warn('[Push] Error saving token:', dbError);
      return {
        success: false,
        error: 'Error al guardar token de notificaciones',
      };
    }

    console.log('[Push] Token registered successfully:', expoPushToken);

    return {
      success: true,
      token: expoPushToken,
    };
  } catch (error) {
    console.warn('[Push] Error registering for notifications:', error);
    return {
      success: false,
      error: 'Error al registrar notificaciones',
    };
  }
}

/**
 * Deactivate push token on logout
 */
export async function deactivatePushToken(technicianId: string): Promise<void> {
  try {
    await supabase
      .from('technician_push_tokens')
      .update({ is_active: false })
      .eq('technician_id', technicianId);

    console.log('[Push] Token deactivated');
  } catch (error) {
    console.warn('[Push] Error deactivating token:', error);
  }
}

/**
 * Setup notification listeners for handling received notifications
 */
export function setupNotificationListeners(
  onNotificationReceived: (notification: Notifications.Notification) => void,
  onNotificationTapped: (response: Notifications.NotificationResponse) => void
) {
  // Foreground notification listener
  const foregroundSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);

  // Background/notification tapped listener
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationTapped);

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Get the last notification response (useful for deep linking on app start)
 */
export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  return await Notifications.getLastNotificationResponseAsync();
}

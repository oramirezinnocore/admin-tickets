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
  const isAndroid = Platform.OS === 'android';
  const platform = Platform.OS;

  try {
    console.log(`[Push][${platform}] Registration START`);
    console.log(`[Push][${platform}] Technician ID:`, technicianId);

    // Check if running on physical device
    console.log(`[Push][${platform}] Device.isDevice:`, Device.isDevice);
    if (!Device.isDevice) {
      console.error(`[Push][${platform}] ERROR: Not a physical device`);
      return {
        success: false,
        error: 'Las notificaciones push solo funcionan en dispositivos físicos',
      };
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log(`[Push][${platform}] Permissions current:`, existingStatus);

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log(`[Push][${platform}] Requesting permissions...`);
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
      console.log(`[Push][${platform}] Permissions requested:`, status);
    }

    console.log(`[Push][${platform}] Permissions final:`, finalStatus);

    if (finalStatus !== 'granted') {
      console.error(`[Push][${platform}] ERROR: Permissions denied`);
      return {
        success: false,
        error: 'Permisos de notificaciones denegados',
      };
    }

    // Get push token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    console.log(`[Push][${platform}] EAS projectId:`, projectId);

    if (!projectId) {
      console.error(`[Push][${platform}] ERROR: No project ID found in config`);
      return {
        success: false,
        error: 'Error de configuración: projectId no encontrado',
      };
    }

    console.log(`[Push][${platform}] Requesting Expo push token...`);
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    const expoPushToken = tokenData.data;
    const tokenSuffix = expoPushToken.slice(-8);
    console.log(`[Push][${platform}] Token generated: YES`);
    console.log(`[Push][${platform}] Token suffix: ...${tokenSuffix}`);

    // Get device info
    const deviceName = Device.deviceName || undefined;
    console.log(`[Push][${platform}] Device name:`, deviceName);
    console.log(`[Push][${platform}] Platform:`, platform);

    // Save token to database
    console.log(`[Push][${platform}] Saving token to Supabase...`);
    const { data: upsertData, error: dbError } = await supabase
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
      )
      .select();

    if (dbError) {
      console.error(`[Push][${platform}] ERROR: Supabase write failed`);
      console.error(`[Push][${platform}] Error code:`, dbError.code);
      console.error(`[Push][${platform}] Error message:`, dbError.message);
      console.error(`[Push][${platform}] Error details:`, dbError.details);
      console.error(`[Push][${platform}] Error hint:`, dbError.hint);
      return {
        success: false,
        error: 'Error al guardar token de notificaciones',
      };
    }

    console.log(`[Push][${platform}] Supabase result:`, upsertData ? 'SUCCESS' : 'UNKNOWN');
    console.log(`[Push][${platform}] Token persisted: YES`);
    console.log(`[Push][${platform}] Registration COMPLETE ✓`);

    return {
      success: true,
      token: expoPushToken,
    };
  } catch (error) {
    console.error(`[Push][${platform}] ERROR: Unexpected error during registration`);
    console.error(`[Push][${platform}] Error:`, error);
    if (error instanceof Error) {
      console.error(`[Push][${platform}] Error message:`, error.message);
      console.error(`[Push][${platform}] Error stack:`, error.stack);
    }
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

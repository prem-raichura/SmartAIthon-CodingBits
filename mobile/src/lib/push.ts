import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Expo Go (SDK 53+) removed remote push; importing expo-notifications eagerly
// also warns. So we detect Expo Go / web and lazy-import only in a real build.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) return null;

  try {
    const Device = await import('expo-device');
    const Notifications = await import('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    // SDK 49+ requires an explicit projectId in standalone builds; without it
    // this throws and push registration silently never works.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return tokenData.data;
  } catch (err) {
    console.warn('[push] registration skipped:', err);
    return null;
  }
}

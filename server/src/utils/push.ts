import Expo from 'expo-server-sdk';
import type { ExpoPushMessage } from 'expo-server-sdk';
import { env } from '../config/env.js';

const expo = new Expo();

export async function sendPush(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  if (!pushToken) return;

  if (env.PUSH_MODE === 'stub') {
    console.log(`[PUSH STUB] → ${pushToken} | ${title}: ${body}`);
    return;
  }

  if (!Expo.isExpoPushToken(pushToken)) {
    console.warn(`[PUSH] Invalid token: ${pushToken}`);
    return;
  }

  const messages: ExpoPushMessage[] = [{ to: pushToken, sound: 'default', title, body, data }];
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error('[PUSH] Send error:', err);
    }
  }
}

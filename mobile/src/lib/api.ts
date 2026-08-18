import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API base URL.
 *
 * EXPO_PUBLIC_API_URL is inlined by Metro at bundle time — set it in eas.json
 * (per build profile) or in mobile/.env for `expo start`. Without it a build
 * used to bake in http://10.0.2.2:4000/api, which is the Android *emulator*
 * loopback and unreachable from a real device, so every request (login
 * included) failed and the app looked like it had crashed.
 *
 * The fallback below derives the dev machine's LAN IP from the Metro host that
 * served the bundle, so `expo start` works on a physical device with no config.
 */
function devHostFromMetro(): string | null {
  const candidate =
    Constants.expoConfig?.hostUri ??
    Constants.manifest2?.extra?.expoGo?.debuggerHost ??
    null;
  if (typeof candidate !== 'string') return null;
  const host = candidate.split(':')[0];
  return host || null;
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  if (Platform.OS === 'web') return 'http://localhost:4000/api';

  const lanHost = devHostFromMetro();
  if (lanHost) return `http://${lanHost}:4000/api`;

  // Last resort: emulator loopback on Android, localhost on iOS simulator.
  return Platform.OS === 'android'
    ? 'http://10.0.2.2:4000/api'
    : 'http://localhost:4000/api';
}

export const BASE_URL = resolveBaseUrl();

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

const REQUEST_TIMEOUT_MS = 15000;

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (opts.token) {
    headers['Authorization'] = `Bearer ${opts.token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Cannot reach server at ${BASE_URL}. Check network / API URL.`);
    }
    throw new Error(`Network error reaching ${BASE_URL}.`);
  } finally {
    clearTimeout(timer);
  }

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const serverMsg = (json as { error?: string }).error ?? `Request failed (${res.status})`;
    if (res.status === 401) {
      throw new Error(`${serverMsg} [${res.status}, auth=${opts.token ? 'sent' : 'MISSING'}]`);
    }
    throw new Error(serverMsg);
  }

  return json as T;
}

export async function uploadPhoto(uri: string, token: string | null): Promise<{ url: string }> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    // On web, uri may be a data URI or blob URL — fetch it and append as Blob
    const blob = await fetch(uri).then((r) => r.blob());
    formData.append('photo', blob, 'photo.jpg');
  } else {
    const filename = uri.split('/').pop() ?? 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    formData.append('photo', { uri, name: filename, type } as unknown as Blob);
  }

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}/uploads`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Upload failed (${res.status})`);
  return json as { url: string };
}

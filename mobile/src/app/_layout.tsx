import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/lib/auth';
import { BASE_URL } from '@/lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// Global guard: any authenticated officer with a temporary password is forced to
// the change-password screen, regardless of which route they try to reach
// (tabs, assignment deep-links, notification taps, etc.).
function PasswordGuard({ children }: { children: React.ReactNode }) {
  const { token, user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onChangePassword = segments[segments.length - 1] === 'change-password';
    if (token && user?.must_change_password && !onChangePassword) {
      router.replace('/(auth)/change-password');
    }
  }, [loading, token, user?.must_change_password, segments, router]);

  return <>{children}</>;
}

/**
 * expo-router renders this instead of a white screen when anything below throws.
 * Without it, a release build gives no clue why the app "crashed on open".
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={styles.errorRoot}>
      <ScrollView contentContainerStyle={styles.errorBody}>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorMessage}>{error?.message ?? 'Unknown error'}</Text>
        <Text style={styles.errorMeta}>API: {BASE_URL}</Text>
        {!!error?.stack && <Text style={styles.errorStack}>{error.stack}</Text>}
        <Pressable style={styles.errorButton} onPress={() => { void retry(); }}>
          <Text style={styles.errorButtonText}>Try again</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export default function RootLayout() {
  return (
    // GestureHandlerRootView is required for gestures to fire on Android;
    // SafeAreaProvider backs the useSafeAreaInsets() calls in the screens.
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="light" />
            <PasswordGuard>
              <Stack screenOptions={{ headerShown: false }} />
            </PasswordGuard>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  errorRoot: { flex: 1, backgroundColor: '#0b1220' },
  errorBody: { padding: 24, paddingTop: 72, gap: 12 },
  errorTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
  errorMessage: { color: '#fca5a5', fontSize: 14, lineHeight: 20 },
  errorMeta: { color: '#94a3b8', fontSize: 12 },
  errorStack: { color: '#64748b', fontSize: 10, lineHeight: 14 },
  errorButton: {
    marginTop: 16,
    alignSelf: 'flex-start',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  errorButtonText: { color: '#ffffff', fontWeight: '700' },
});

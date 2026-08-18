import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { useAuth } from '@/lib/auth';
import { colors, gradients, radius, spacing, type } from '@/lib/theme';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={gradients.navy} style={styles.bg}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.brand}>
              <Image
                source={require('../../../assets/logo.png')}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.appName}>ParkVUE</Text>
              <Text style={styles.appSub}>Keep Cities Moving</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.heading}>Welcome back</Text>
              <Text style={styles.sub}>Sign in to continue your patrol</Text>

              <Field
                label="Username"
                icon="person-outline"
                value={username}
                onChangeText={setUsername}
                placeholder="officer"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Field
                  label="Password"
                  icon="lock-closed-outline"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  secureTextEntry={!showPw}
                  rightElement={
                    <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10}>
                      <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
                    </Pressable>
                  }
                />

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.risk.critical} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Button title="Sign in" icon="log-in-outline" onPress={handleLogin} loading={loading} style={{ marginTop: spacing.xs }} />

              <Pressable onPress={() => router.push('/(auth)/register' as never)} style={styles.link}>
                <Text style={styles.linkText}>
                  New officer? <Text style={styles.linkStrong}>Register here</Text>
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  brand: {
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 22,
    marginBottom: spacing.xs,
  },
  appName: {
    ...type.h2,
    color: colors.white,
    textAlign: 'center',
  },
  appSub: {
    ...type.caption,
    color: colors.accent,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  heading: {
    ...type.h1,
    color: colors.text,
  },
  sub: {
    ...type.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.risk.critical + '12',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: {
    ...type.caption,
    color: colors.risk.critical,
    flex: 1,
  },
  link: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    ...type.body,
    color: colors.textMuted,
  },
  linkStrong: {
    color: colors.primary,
    fontWeight: '700',
  },
});

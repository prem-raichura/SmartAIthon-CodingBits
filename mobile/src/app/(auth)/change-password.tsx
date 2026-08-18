import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { useAuth } from '@/lib/auth';
import { colors, gradients, radius, spacing, type } from '@/lib/theme';

export default function ChangePasswordScreen() {
  const { user, changePassword, logout } = useAuth();
  const router = useRouter();
  const forced = !!user?.must_change_password;

  async function handleLogout() {
    await logout();
    router.replace('/(auth)/login');
  }

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
    return (
      <Pressable onPress={onToggle} hitSlop={10}>
        <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
      </Pressable>
    );
  }

  async function handleSubmit() {
    if (next.length < 6) return setError('New password must be at least 6 characters.');
    if (next !== confirm) return setError('Passwords do not match.');
    if (!forced && !current) return setError('Enter your current password.');
    setError('');
    setLoading(true);
    try {
      await changePassword(next, forced ? undefined : current);
      router.replace('/(tabs)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not change password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={gradients.navy} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <View style={styles.cardIcon}>
                <Ionicons name="lock-closed" size={26} color={colors.accent} />
              </View>
              <Text style={styles.heading}>{forced ? 'Set a new password' : 'Change password'}</Text>
              <Text style={styles.sub}>
                {forced
                  ? 'For security you must change your temporary password before continuing.'
                  : 'Choose a new password for your account.'}
              </Text>

              {!forced && (
                <Field
                  label="Current password"
                  icon="key-outline"
                  value={current}
                  onChangeText={setCurrent}
                  placeholder="Current password"
                  secureTextEntry={!showCurrent}
                  autoCapitalize="none"
                  rightElement={<EyeToggle show={showCurrent} onToggle={() => setShowCurrent((s) => !s)} />}
                />
              )}
              <Field
                label="New password"
                icon="lock-closed-outline"
                value={next}
                onChangeText={setNext}
                placeholder="At least 6 characters"
                secureTextEntry={!showNext}
                autoCapitalize="none"
                rightElement={<EyeToggle show={showNext} onToggle={() => setShowNext((s) => !s)} />}
              />
              <Field
                label="Confirm new password"
                icon="lock-closed-outline"
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter new password"
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                rightElement={<EyeToggle show={showConfirm} onToggle={() => setShowConfirm((s) => !s)} />}
              />

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color={colors.risk.critical} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Button title="Update password" icon="checkmark-outline" onPress={handleSubmit} loading={loading}
                style={{ marginTop: spacing.xs }} />

              <Pressable onPress={handleLogout} style={styles.logout} hitSlop={8}>
                <Ionicons name="log-out-outline" size={18} color={colors.textMuted} />
                <Text style={styles.logoutText}>Log out</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.xxl },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg },
  cardIcon: {
    width: 56, height: 56, borderRadius: radius.lg, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md,
  },
  heading: { ...type.h1, color: colors.text },
  sub: { ...type.body, color: colors.textMuted, marginBottom: spacing.lg, marginTop: 2, lineHeight: 20 },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.risk.critical + '12',
    borderRadius: radius.sm, padding: spacing.sm, marginBottom: spacing.sm,
  },
  errorText: { ...type.caption, color: colors.risk.critical, flex: 1 },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing.md, paddingVertical: spacing.sm,
  },
  logoutText: { ...type.body, color: colors.textMuted, fontWeight: '600' },
});

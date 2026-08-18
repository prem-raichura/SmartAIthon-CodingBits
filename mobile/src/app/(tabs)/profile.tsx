import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { useAuth } from '@/lib/auth';
import { useMe, useRegisterPushToken, useUpdateProfile } from '@/lib/queries';
import { getExpoPushToken } from '@/lib/push';
import { colors, gradients, radius, shadow, spacing, type } from '@/lib/theme';

export default function ProfileScreen() {
  const { logout, token } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const registerToken = useRegisterPushToken();
  const updateProfile = useUpdateProfile();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [number, setNumber] = useState('');

  function startEdit() {
    setName(me?.name ?? '');
    setUsername(me?.username ?? '');
    setEmail(me?.email ?? '');
    setNumber(me?.number ?? '');
    setEditing(true);
  }

  async function handleSave() {
    if (!name.trim() || !email.trim() || !username.trim()) {
      Alert.alert('Missing info', 'Name, username and email are required.');
      return;
    }
    try {
      await updateProfile.mutateAsync({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        number: number.trim(),
      });
      setEditing(false);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e) {
      Alert.alert('Save failed', e instanceof Error ? e.message : 'Could not update profile.');
    }
  }

  useEffect(() => {
    if (!token) return;
    getExpoPushToken()
      .then((t) => {
        if (t) registerToken.mutate(t);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleLogout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  }

  return (
    <View style={styles.safe}>
      <LinearGradient colors={gradients.header} style={[styles.hero, { paddingTop: insets.top + spacing.lg }]}>
        {!editing && (
          <Pressable onPress={startEdit} hitSlop={12} style={[styles.editBtn, { top: insets.top + spacing.sm }]}>
            <Ionicons name="create-outline" size={20} color={colors.white} />
          </Pressable>
        )}
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{me?.name?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{me?.name ?? '—'}</Text>
        <View style={styles.usernamePill}>
          <Ionicons name="shield-checkmark" size={13} color={colors.accent} />
          <Text style={styles.username}>@{me?.username ?? '—'}</Text>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content}>
        {editing ? (
          <View style={styles.card}>
            <View style={styles.editCardInner}>
              <Field
                label="Full name"
                icon="person-outline"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoCapitalize="words"
              />
              <Field
                label="Username"
                icon="at-outline"
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Field
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Field
                label="Mobile"
                icon="call-outline"
                value={number}
                onChangeText={setNumber}
                placeholder="+91 XXXXX XXXXX"
                keyboardType="phone-pad"
              />
              <Text style={styles.editHint}>Role and police station are managed by admin.</Text>
              <View style={styles.editActions}>
                <View style={styles.editActionFlex}>
                  <Button
                    title="Cancel"
                    icon="close-outline"
                    variant="outline"
                    onPress={() => setEditing(false)}
                  />
                </View>
                <View style={styles.editActionFlex}>
                  <Button
                    title="Save"
                    icon="checkmark-outline"
                    onPress={handleSave}
                    loading={updateProfile.isPending}
                  />
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Row icon="mail-outline" label="Email" value={me?.email} />
            <Row icon="call-outline" label="Mobile" value={me?.number} />
            <Row icon="business-outline" label="Police station" value={me?.police_station} />
            <Row icon="ribbon-outline" label="Role" value={me?.role ? me.role.charAt(0).toUpperCase() + me.role.slice(1) : undefined} />
            <Row
              icon="ellipse"
              label="Status"
              value={me?.is_active ? 'Active' : 'Inactive'}
              valueColor={me?.is_active ? colors.risk.low : colors.risk.critical}
              last
            />
          </View>
        )}

        {!editing && (
          <>
            <Pressable
              onPress={() => router.push('/(auth)/change-password' as never)}
              style={({ pressed }) => [styles.changePassRow, pressed && styles.changePassRowPressed]}
            >
              <View style={styles.changePassLeft}>
                <View style={styles.changePassIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                </View>
                <Text style={styles.changePassLabel}>Change password</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>

            <View style={styles.notice}>
              <Ionicons name="notifications-outline" size={16} color={colors.textMuted} />
              <Text style={styles.noticeText}>Push notifications are registered for this device.</Text>
            </View>

            <Button title="Sign out" icon="log-out-outline" variant="danger" onPress={handleLogout} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  valueColor,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  valueColor?: string;
  last?: boolean;
}) {
  return (
    <View style={[rowStyles.row, last && { borderBottomWidth: 0 }]}>
      <View style={rowStyles.left}>
        <Ionicons name={icon} size={18} color={colors.textMuted} />
        <Text style={rowStyles.label}>{label}</Text>
      </View>
      <Text style={[rowStyles.value, valueColor && { color: valueColor }]} numberOfLines={1}>
        {value ?? '—'}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md - 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...type.body, color: colors.textMuted },
  value: { ...type.bodyStrong, color: colors.text, maxWidth: '55%', textAlign: 'right' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  hero: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  editBtn: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  editCardInner: {
    paddingVertical: spacing.md,
  },
  editHint: {
    ...type.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editActionFlex: {
    flex: 1,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadow.md,
  },
  avatarText: { fontSize: 38, fontWeight: '800', color: colors.primary },
  name: { ...type.h1, color: colors.white },
  usernamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  username: { ...type.caption, color: colors.white },
  content: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...shadow.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  noticeText: { ...type.caption, color: colors.textMuted, flex: 1 },
  changePassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...shadow.sm,
  },
  changePassRowPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.985 }],
  },
  changePassLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  changePassIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePassLabel: {
    ...type.bodyStrong,
    color: colors.text,
  },
});

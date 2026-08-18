import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNowStrict } from 'date-fns';
import { useRouter } from 'expo-router';
import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ListSkeleton } from '@/components/Skeleton';
import { useMarkRead, useNotifications, type AppNotification } from '@/lib/queries';
import { colors, radius, shadow, spacing, type } from '@/lib/theme';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  assignment: 'navigate-circle',
  reminder: 'alarm',
  system: 'information-circle',
};
const TYPE_COLOR: Record<string, string> = {
  assignment: colors.status.active,
  reminder: colors.accent,
  system: colors.textMuted,
};

export default function NotificationsScreen() {
  const { data, isLoading, refetch, isRefetching } = useNotifications();
  const router = useRouter();
  const markRead = useMarkRead();

  function handleTap(n: AppNotification) {
    if (!n.is_read) markRead.mutate(n.notification_id);
    if (n.assignment_id) router.push(`/assignment/${n.assignment_id}` as never);
  }

  const unread = data?.filter((n) => !n.is_read).length ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScreenHeader
        title="Alerts"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
      />
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={isLoading ? [] : data ?? []}
        keyExtractor={(n) => n.notification_id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListHeaderComponent={isLoading ? <ListSkeleton count={3} /> : null}
        renderItem={({ item: n }) => {
          const c = TYPE_COLOR[n.type] ?? colors.textMuted;
          return (
            <Pressable
              style={({ pressed }) => [styles.card, shadow.sm, !n.is_read && styles.cardUnread, pressed && styles.pressed]}
              onPress={() => handleTap(n)}
            >
              <View style={[styles.iconWrap, { backgroundColor: c + '14' }]}>
                <Ionicons name={TYPE_ICON[n.type] ?? 'notifications'} size={20} color={c} />
              </View>
              <View style={styles.body}>
                <View style={styles.titleRow}>
                  <Text style={styles.title} numberOfLines={1}>{n.title}</Text>
                  {!n.is_read && <View style={styles.dot} />}
                </View>
                <Text style={styles.text} numberOfLines={2}>{n.body}</Text>
                <Text style={styles.time}>{formatDistanceToNowStrict(new Date(n.sent_at))} ago</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState icon="notifications-off-outline" title="No alerts" subtitle="New assignment notifications will appear here." />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.sm, flexGrow: 1 },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardUnread: {
    borderColor: colors.accent + '55',
    backgroundColor: '#FFFDF7',
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...type.bodyStrong, color: colors.text, flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  text: { ...type.caption, color: colors.textMuted, lineHeight: 18 },
  time: { ...type.micro, color: colors.textFaint, fontSize: 10, letterSpacing: 0, marginTop: 2 },
});

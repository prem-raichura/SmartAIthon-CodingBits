import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AssignmentCard } from '@/components/AssignmentCard';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ListSkeleton } from '@/components/Skeleton';
import { useAssignments, type Assignment } from '@/lib/queries';
import { colors, radius, spacing, type } from '@/lib/theme';

const FILTERS = ['all', 'active', 'completed'] as const;
type Filter = (typeof FILTERS)[number];

export default function PatrolScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useAssignments();
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c = { active: 0, completed: 0 };
    (data ?? []).forEach((a) => {
      if (a.status === 'active') c.active++;
      else if (a.status === 'completed') c.completed++;
    });
    return c;
  }, [data]);

  // Overdue: active assignment past its deadline with no report submitted yet.
  const overdue = useMemo(
    () => (data ?? []).find((a) => a.status === 'active' && a.time_limit && new Date(a.time_limit) < new Date() && !a.validation),
    [data],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return data ?? [];
    return (data ?? []).filter((a) => a.status === filter);
  }, [data, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScreenHeader
        title="Patrol Zones"
        subtitle="ParkVUE · Keep Cities Moving"
        right={
          <View style={styles.headerStat}>
            <Text style={styles.headerStatNum}>{data?.length ?? 0}</Text>
            <Text style={styles.headerStatLabel}>total</Text>
          </View>
        }
      />

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={isLoading ? [] : filtered}
        keyExtractor={(a: Assignment) => a.id}
        renderItem={({ item }) => <AssignmentCard assignment={item} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} colors={[colors.primary]} />
        }
        ListHeaderComponent={
          <View>
            {overdue && (
              <Pressable style={styles.overdue} onPress={() => router.push(`/assignment/${overdue.id}/validate` as never)}>
                <Ionicons name="alert-circle" size={20} color={colors.white} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overdueTitle}>Report overdue</Text>
                  <Text style={styles.overdueSub}>Your patrol time has ended — submit your field report now.</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.white} />
              </Pressable>
            )}
            <View style={styles.statsRow}>
              <StatCard icon="navigate-circle" color={colors.status.active} num={counts.active} label="Active" />
              <StatCard icon="checkmark-done-circle" color={colors.status.completed} num={counts.completed} label="Done" />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {FILTERS.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.chip, filter === f && styles.chipActive]}
                >
                  <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {isLoading && <ListSkeleton />}
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="map-outline"
              title={filter === 'all' ? 'No patrol zones' : `No ${filter} zones`}
              subtitle={filter === 'all' ? 'You have no assignments yet. Pull down to refresh.' : 'Try a different filter.'}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function StatCard({ icon, color, num, label }: { icon: keyof typeof Ionicons.glyphMap; color: string; num: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '14' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View>
        <Text style={styles.statNum}>{num}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.lg, flexGrow: 1 },
  headerStat: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    minWidth: 56,
  },
  headerStatNum: { ...type.h2, color: colors.white },
  headerStatLabel: { ...type.micro, color: colors.accent, fontSize: 9 },
  overdue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.risk.high,
    borderRadius: radius.md,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  overdueTitle: { ...type.bodyStrong, color: colors.white },
  overdueSub: { ...type.caption, color: 'rgba(255,255,255,0.85)' },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },

  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 2,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statNum: { ...type.h3, color: colors.text },
  statLabel: { ...type.micro, color: colors.textMuted, fontSize: 9.5 },
  chips: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { ...type.label, color: colors.textMuted },
  chipTextActive: { color: colors.white },
});

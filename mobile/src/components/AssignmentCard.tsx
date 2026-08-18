import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format, formatDistanceToNowStrict, isPast } from 'date-fns';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Assignment } from '@/lib/queries';
import { colors, radius, riskColor, riskIcon, shadow, spacing, type } from '@/lib/theme';
import { RiskBadge } from './RiskBadge';
import { StatusPill } from './StatusPill';

interface Props {
  assignment: Assignment;
}

export function AssignmentCard({ assignment: a }: Props) {
  const router = useRouter();
  const { cell } = a;
  const rColor = riskColor(cell.risk_level);

  const deadline = a.time_limit ? new Date(a.time_limit) : null;
  const overdue = deadline ? isPast(deadline) && a.status !== 'completed' : false;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, shadow.sm, pressed && styles.pressed, pressed && { borderColor: rColor + '55' }]}
      onPress={() => router.push(`/assignment/${a.id}` as never)}
    >
      <View style={[styles.iconCol, { backgroundColor: rColor + '14' }]}>
        <Ionicons
          name={(riskIcon[cell.risk_level] ?? 'location') as keyof typeof Ionicons.glyphMap}
          size={22}
          color={rColor}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={styles.zone} numberOfLines={1}>
            Zone {cell.h3_index.slice(-6).toUpperCase()}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="warning-outline" size={13} color={colors.textMuted} />
          <Text style={styles.meta}>
            {cell.predicted_violations != null ? `${cell.predicted_violations} predicted` : 'No data'}
          </Text>
          <View style={styles.dot} />
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.meta}>{cell.prediction_window}</Text>
        </View>

        <View style={styles.badgeRow}>
          <RiskBadge level={cell.risk_level} size="sm" />
          <StatusPill status={a.status} size="sm" />
          {deadline && (
            <View style={styles.deadlineChip}>
              <Ionicons
                name={overdue ? 'alert-circle' : 'hourglass-outline'}
                size={11}
                color={overdue ? colors.risk.critical : colors.textMuted}
              />
              <Text style={[styles.deadline, overdue && { color: colors.risk.critical }]}>
                {a.status === 'completed'
                  ? format(deadline, 'dd MMM')
                  : overdue
                    ? 'Overdue'
                    : formatDistanceToNowStrict(deadline) + ' left'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.982 }],
  },
  iconCol: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 7,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zone: {
    ...type.h3,
    color: colors.text,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    ...type.caption,
    color: colors.textMuted,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginHorizontal: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  deadlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deadline: {
    ...type.micro,
    fontSize: 10,
    letterSpacing: 0.2,
    color: colors.textMuted,
  },
});

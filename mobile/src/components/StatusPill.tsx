import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, statusColor, statusIcon } from '@/lib/theme';

const LABELS: Record<string, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  expired: 'Expired',
};

export function StatusPill({ status, size = 'md' }: { status: string; size?: 'sm' | 'md' }) {
  const color = statusColor(status);
  const small = size === 'sm';
  return (
    <View style={[styles.pill, { backgroundColor: color + '14', borderColor: color + '33' }, small && styles.pillSm]}>
      <Ionicons name={(statusIcon[status] ?? 'ellipse') as keyof typeof Ionicons.glyphMap} size={small ? 11 : 13} color={color} />
      <Text style={[styles.label, { color }, small && styles.labelSm]}>{LABELS[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    alignSelf: 'flex-start',
  },
  pillSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
  labelSm: {
    fontSize: 10.5,
  },
});

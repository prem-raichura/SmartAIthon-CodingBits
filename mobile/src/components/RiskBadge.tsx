import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, riskColor, riskIcon } from '@/lib/theme';

interface Props {
  level: string;
  size?: 'sm' | 'md';
}

export function RiskBadge({ level, size = 'md' }: Props) {
  const color = riskColor(level);
  const small = size === 'sm';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: color + '1A', borderColor: color + '40' },
        small && styles.badgeSm,
      ]}
    >
      <Ionicons name={(riskIcon[level] ?? 'ellipse') as keyof typeof Ionicons.glyphMap} size={small ? 11 : 13} color={color} />
      <Text style={[styles.label, { color }, small && styles.labelSm]}>{level.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  labelSm: {
    fontSize: 9.5,
  },
});

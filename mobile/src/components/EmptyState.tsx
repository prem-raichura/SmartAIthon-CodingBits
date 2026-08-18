import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '@/lib/theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export function EmptyState({ icon = 'file-tray-outline', title, subtitle }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={34} color={colors.textFaint} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
    minHeight: 280,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...type.h3,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
});

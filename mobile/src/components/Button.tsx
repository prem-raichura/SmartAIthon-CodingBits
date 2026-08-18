import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, gradients, radius, spacing } from '@/lib/theme';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger';

interface Props extends PressableProps {
  title: string;
  variant?: Variant;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  small?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  loading,
  disabled,
  icon,
  small,
  style,
  ...props
}: Props) {
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;

  const inner = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.primary : tint(variant)} size="small" />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={small ? 16 : 18}
              color={isPrimary ? colors.primary : tint(variant)}
            />
          )}
          <Text
            style={[
              styles.label,
              small && styles.labelSmall,
              { color: isPrimary ? colors.primary : tint(variant) },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </View>
  );

  if (isPrimary) {
    return (
      <Pressable disabled={isDisabled} style={({ pressed }) => [pressed && styles.pressed, isDisabled && styles.disabled, style as object]} {...props}>
        <LinearGradient
          colors={gradients.amber}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, small && styles.baseSmall]}
        >
          {inner}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        small && styles.baseSmall,
        variant === 'outline' && styles.outline,
        variant === 'danger' && styles.danger,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style as object,
      ]}
      {...props}
    >
      {inner}
    </Pressable>
  );
}

function tint(variant: Variant): string {
  if (variant === 'danger') return colors.risk.critical;
  return colors.primary;
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  baseSmall: {
    height: 40,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  outline: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  danger: {
    borderWidth: 1.5,
    borderColor: colors.risk.critical,
    backgroundColor: colors.card,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  labelSmall: {
    fontSize: 13,
  },
});

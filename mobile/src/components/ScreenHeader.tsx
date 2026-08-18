import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gradients, spacing, type } from '@/lib/theme';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  compact?: boolean;
}

export function ScreenHeader({ title, subtitle, onBack, right, compact }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={gradients.header}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + (compact ? 8 : 14) }]}
    >
      <View style={styles.rowTop}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.white} />
          </Pressable>
        ) : (
          <View style={styles.brandDot}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.brandLogo}
              contentFit="contain"
            />
          </View>
        )}
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandDot: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogo: {
    width: 34,
    height: 34,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    ...type.h2,
    color: colors.white,
  },
  subtitle: {
    ...type.caption,
    color: colors.accent,
    marginTop: 2,
  },
  right: {
    marginLeft: spacing.sm,
  },
});

import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/lib/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

function Shimmer({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.block, { opacity }, style]} />;
}

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Shimmer style={{ width: 74, height: 22, borderRadius: radius.full }} />
        <Shimmer style={{ width: 90, height: 22, borderRadius: radius.full }} />
      </View>
      <Shimmer style={{ width: '60%', height: 18, marginTop: spacing.sm }} />
      <Shimmer style={{ width: '85%', height: 13, marginTop: spacing.sm }} />
      <Shimmer style={{ width: '45%', height: 13, marginTop: 6 }} />
    </View>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ paddingTop: spacing.md, gap: spacing.sm }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#E2E6EF',
    borderRadius: radius.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginHorizontal: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

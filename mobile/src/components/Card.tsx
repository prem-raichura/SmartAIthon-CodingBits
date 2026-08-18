import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius, shadow } from '@/lib/theme';

interface Props extends ViewProps {
  elevation?: 'sm' | 'md' | 'lg' | 'none';
  padded?: boolean;
}

export function Card({ elevation = 'sm', padded = true, style, children, ...rest }: Props) {
  return (
    <View
      style={[
        styles.card,
        padded && styles.padded,
        elevation !== 'none' && shadow[elevation],
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  padded: {
    padding: 16,
  },
});

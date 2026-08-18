import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing, type } from '@/lib/theme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
}

export function Field({ label, error, icon, rightElement, style, onFocus, onBlur, ...props }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          focused && styles.inputWrapFocused,
          error && styles.inputWrapError,
        ]}
      >
        {icon && <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textFaint} style={styles.icon} />}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textFaint}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...props}
        />
        {rightElement && <View style={styles.rightEl}>{rightElement}</View>}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    ...type.label,
    color: colors.text,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  inputWrapFocused: {
    borderColor: colors.primary,
  },
  inputWrapError: {
    borderColor: colors.risk.critical,
  },
  icon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm + 2,
  },
  rightEl: {
    marginLeft: spacing.xs,
    padding: spacing.xs,
  },
  error: {
    marginTop: 5,
    ...type.caption,
    color: colors.risk.critical,
  },
});

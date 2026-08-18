import React, { useEffect, useRef } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { colors, shadow } from '@/lib/theme';

const TRACK_W = 50;
const TRACK_H = 30;
const PAD = 3;
const KNOB = 24;
const TRAVEL = TRACK_W - KNOB - PAD * 2;

interface Props {
  value: boolean;
  onValueChange: (next: boolean) => void;
}

/**
 * Switch with a knob that actually slides — it animates on tap and follows a
 * horizontal drag. The previous version swapped two static styles, so the knob
 * teleported and drag did nothing.
 */
export function ToggleSwitch({ value, onValueChange }: Props) {
  const x = useRef(new Animated.Value(value ? TRAVEL : 0)).current;
  // Kept in a ref because the PanResponder is created once and would otherwise
  // capture the first render's props.
  const valueRef = useRef(value);
  valueRef.current = value;
  const dragging = useRef(false);

  useEffect(() => {
    if (dragging.current) return;
    Animated.spring(x, {
      toValue: value ? TRAVEL : 0,
      useNativeDriver: Platform.OS !== 'web',
      bounciness: 4,
      speed: 18,
    }).start();
  }, [value, x]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: () => { dragging.current = true; },
      onPanResponderMove: (_e, g) => {
        const base = valueRef.current ? TRAVEL : 0;
        x.setValue(Math.min(TRAVEL, Math.max(0, base + g.dx)));
      },
      onPanResponderRelease: (_e, g) => {
        dragging.current = false;
        const base = valueRef.current ? TRAVEL : 0;
        const finalX = Math.min(TRAVEL, Math.max(0, base + g.dx));
        // A tap (no travel) toggles; a drag settles to the nearer end.
        const next = Math.abs(g.dx) < 4 ? !valueRef.current : finalX > TRAVEL / 2;

        Animated.spring(x, {
          toValue: next ? TRAVEL : 0,
          useNativeDriver: Platform.OS !== 'web',
          bounciness: 4,
          speed: 18,
        }).start();

        if (next !== valueRef.current) onValueChange(next);
      },
      onPanResponderTerminate: () => { dragging.current = false; },
    }),
  ).current;

  return (
    <View
      {...pan.panHandlers}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[styles.track, value && styles.trackOn]}
    >
      <Animated.View style={[styles.knob, { transform: [{ translateX: x }] }]} />
    </View>
  );
}

/** Row wrapper: tapping anywhere on the row toggles, matching the old layout. */
export function ToggleRow({
  children,
  value,
  onValueChange,
  style,
}: Props & { children: React.ReactNode; style?: object }) {
  return (
    <Pressable style={style} onPress={() => onValueChange(!value)}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    backgroundColor: colors.borderStrong,
    padding: PAD,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.accent },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: colors.white,
    ...shadow.sm,
  },
});

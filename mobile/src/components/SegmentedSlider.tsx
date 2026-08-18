import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, PanResponder, Platform, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, type } from '@/lib/theme';

interface Props<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** Colour per option, used for the indicator and the active label. */
  colorFor: (option: T) => string;
}

/**
 * Segmented control whose indicator slides between stops. Tapping a segment
 * jumps to it; dragging the indicator scrubs through them. Replaces a row of
 * independent tap-only chips that had no slider behaviour at all.
 */
export function SegmentedSlider<T extends string>({ options, value, onChange, colorFor }: Props<T>) {
  const [trackW, setTrackW] = useState(0);
  const segW = trackW > 0 ? trackW / options.length : 0;

  const index = Math.max(0, options.indexOf(value));
  const x = useRef(new Animated.Value(0)).current;

  // Refs so the PanResponder (created once) always sees current values.
  const stateRef = useRef({ index, segW, options, onChange });
  stateRef.current = { index, segW, options, onChange };
  const dragging = useRef(false);

  useEffect(() => {
    if (dragging.current || segW === 0) return;
    Animated.spring(x, {
      toValue: index * segW,
      useNativeDriver: Platform.OS !== 'web',
      bounciness: 2,
      speed: 20,
    }).start();
  }, [index, segW, x]);

  function settle(px: number) {
    const { segW: w, options: opts, onChange: cb, index: current } = stateRef.current;
    if (w === 0) return;
    const next = Math.min(opts.length - 1, Math.max(0, Math.round(px / w)));
    Animated.spring(x, {
      toValue: next * w,
      useNativeDriver: Platform.OS !== 'web',
      bounciness: 2,
      speed: 20,
    }).start();
    if (next !== current) cb(opts[next]);
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2,
      onPanResponderGrant: (e) => {
        dragging.current = true;
        // Grab wherever the finger landed.
        x.setValue(clampToTrack(e.nativeEvent.locationX - stateRef.current.segW / 2));
      },
      onPanResponderMove: (e) => {
        x.setValue(clampToTrack(e.nativeEvent.locationX - stateRef.current.segW / 2));
      },
      onPanResponderRelease: (e) => {
        dragging.current = false;
        settle(clampToTrack(e.nativeEvent.locationX - stateRef.current.segW / 2));
      },
      onPanResponderTerminate: () => {
        dragging.current = false;
        settle(stateRef.current.index * stateRef.current.segW);
      },
    }),
  ).current;

  function clampToTrack(px: number): number {
    const { segW: w, options: opts } = stateRef.current;
    const max = w * (opts.length - 1);
    return Math.min(max, Math.max(0, px));
  }

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    setTrackW(w);
    x.setValue((w / options.length) * index);
  }

  const activeColor = colorFor(value);

  return (
    <View style={styles.track} onLayout={onLayout} {...pan.panHandlers}>
      {segW > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            {
              width: segW,
              backgroundColor: activeColor + '18',
              borderColor: activeColor,
              transform: [{ translateX: x }],
            },
          ]}
        />
      )}
      {options.map((opt) => {
        const active = opt === value;
        return (
          <View key={opt} style={styles.segment} pointerEvents="none">
            <Text style={[styles.label, active && { color: colorFor(opt) }]} numberOfLines={1}>
              {opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { ...type.label, color: colors.textMuted },
});

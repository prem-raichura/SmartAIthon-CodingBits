import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { buildPatrolMapHTML } from './patrolMapHtml';
import { EmptyState } from './EmptyState';

interface Props {
  lat: number | null;
  lng: number | null;
  risk: string;
  userLat?: number | null;
  userLng?: number | null;
}

export interface PatrolMapHandle {
  postMessage?: (msg: string) => void;
}

/**
 * Web build of the patrol map.
 *
 * react-native-webview has no web implementation — rendering it in a browser
 * throws "React Native WebView does not support this platform" and the map area
 * stays blank. An iframe with the same Leaflet document behaves identically and
 * needs no extra dependency.
 */
export const PatrolMap = forwardRef<PatrolMapHandle, Props>(function PatrolMap(
  { lat, lng, risk, userLat, userLng },
  ref,
) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useImperativeHandle(ref, () => ({
    postMessage: (msg: string) => {
      // The iframe listens for window 'message' and reads event.data.
      frameRef.current?.contentWindow?.postMessage(msg, '*');
    },
  }), []);

  const html = useMemo(
    () => (lat == null || lng == null ? '' : buildPatrolMapHTML(lat, lng, risk, userLat, userLng)),
    // Rebuilding on every location tick would reload the map; live updates
    // arrive through postMessage instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lng, risk],
  );

  if (lat == null || lng == null) {
    return (
      <View style={styles.placeholder}>
        <EmptyState
          icon="location-outline"
          title="Zone coordinates unavailable"
          subtitle="Location data not set for this patrol zone."
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <iframe
        ref={frameRef}
        srcDoc={html}
        title="Patrol zone map"
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    </View>
  );
});

export function updateUserLocation(
  ref: React.RefObject<PatrolMapHandle | null>,
  lat: number,
  lng: number,
) {
  ref.current?.postMessage?.(JSON.stringify({ type: 'location', lat, lng }));
}

const styles = StyleSheet.create({
  container: {
    height: 280,
    overflow: 'hidden',
    borderRadius: 0,
  },
  placeholder: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

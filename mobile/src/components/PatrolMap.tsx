import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
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
 * Leaflet in a WebView on every platform. Deliberately not react-native-maps:
 * that needs a Google Maps API key on Android (absent here, which produced dead
 * grey tiles in release builds) and could not move the live user marker.
 */
export const PatrolMap = forwardRef<PatrolMapHandle, Props>(function PatrolMap(
  { lat, lng, risk, userLat, userLng },
  ref,
) {
  const webViewRef = useRef<WebView>(null);

  // Expose postMessage so the screen can push live location into the map
  // without re-rendering (and reloading) the whole WebView.
  useImperativeHandle(ref, () => ({
    postMessage: (msg: string) => webViewRef.current?.postMessage(msg),
  }), []);

  // The HTML is built once per zone. userLat/userLng only seed the first
  // marker; later updates arrive via postMessage.
  const html = useMemo(
    () => (lat == null || lng == null ? '' : buildPatrolMapHTML(lat, lng, risk, userLat, userLng)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lat, lng, risk],
  );

  if (lat == null || lng == null) {
    return (
      <View style={styles.placeholder}>
        <EmptyState icon="location-outline" title="Zone coordinates unavailable" subtitle="Location data not set for this patrol zone." />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
        scrollEnabled={false}
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
  webview: {
    flex: 1,
  },
  placeholder: {
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

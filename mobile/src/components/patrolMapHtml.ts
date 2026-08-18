import { riskColor } from '@/lib/theme';

/**
 * Self-contained Leaflet + OpenStreetMap page for the patrol map.
 *
 * OSM is free and needs no API key or billing account, unlike Google Maps
 * (react-native-maps) which requires `android.config.googleMaps.apiKey`.
 *
 * Shared by both renderers: a react-native-webview on native, an iframe on web
 * (react-native-webview does not support the web platform).
 */
export function buildPatrolMapHTML(
  lat: number,
  lng: number,
  risk: string,
  userLat?: number | null,
  userLng?: number | null,
): string {
  const zoneColor = riskColor(risk);
  const userMarker =
    userLat != null && userLng != null
      ? `L.circleMarker([${userLat}, ${userLng}], {radius:8,color:'#1D4ED8',fillColor:'#3B82F6',fillOpacity:0.9,weight:2}).addTo(map).bindPopup('Your location');`
      : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;}
</style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {zoomControl:true, attributionControl:true});
  // Set a view BEFORE adding layers. L.circle measures its radius in metres and
  // needs a projected view to compute getBounds(); without one, fitBounds()
  // silently does nothing, the map never loads, and zero tiles are requested.
  map.setView([${lat}, ${lng}], 15);
  // OpenStreetMap: free, no API key, no billing account. Attribution is
  // required by the tile usage policy.
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var zone = L.circle([${lat}, ${lng}], {
    radius: 450,
    color: '${zoneColor}',
    fillColor: '${zoneColor}',
    fillOpacity: 0.12,
    dashArray: '6 8',
    weight: 2.5,
  }).addTo(map);

  L.circleMarker([${lat}, ${lng}], {
    radius: 5,
    color: '${zoneColor}',
    fillColor: '${zoneColor}',
    fillOpacity: 1,
    weight: 2,
  }).addTo(map).bindPopup('Zone centroid');

  ${userMarker}

  function fit() {
    // Leaflet requests no tiles at all if the container measured 0x0 when the
    // map was created — which happens inside an iframe/WebView that lays out
    // after the document parses. Re-measure, then re-fit.
    map.invalidateSize(false);
    map.fitBounds(zone.getBounds(), {padding:[24,24]});
  }

  fit();
  window.addEventListener('load', fit);
  window.addEventListener('resize', fit);
  setTimeout(fit, 150);
  setTimeout(fit, 600);

  function applyMessage(raw) {
    try {
      var d = JSON.parse(raw);
      if (d.type === 'location') {
        if (window._userMarker) { window._userMarker.setLatLng([d.lat, d.lng]); }
        else { window._userMarker = L.circleMarker([d.lat,d.lng],{radius:8,color:'#1D4ED8',fillColor:'#3B82F6',fillOpacity:0.9,weight:2}).addTo(map); }
      }
    } catch(err){}
  }

  // react-native-webview delivers via window/document 'message';
  // the web iframe receives a postMessage event whose data is the payload.
  window.addEventListener('message', function(e) { applyMessage(e.data); });
  document.addEventListener('message', function(e) { applyMessage(e.data); });
</script>
</body>
</html>`;
}

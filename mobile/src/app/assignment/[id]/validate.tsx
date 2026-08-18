import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { captureRef } from 'react-native-view-shot';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SegmentedSlider } from '@/components/SegmentedSlider';
import { ToggleRow, ToggleSwitch } from '@/components/ToggleSwitch';
import { uploadPhoto } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAssignment, useSubmitValidation } from '@/lib/queries';
import { colors, radius, riskColor, shadow, spacing, type } from '@/lib/theme';

const SEVERITY_OPTIONS = ['none', 'low', 'medium', 'high'] as const;
type Severity = (typeof SEVERITY_OPTIONS)[number];
const SEVERITY_COLOR: Record<Severity, string> = {
  none: colors.textMuted,
  low: riskColor('low'),
  medium: riskColor('medium'),
  high: riskColor('high'),
};

interface StampInfo {
  lat: number;
  lng: number;
  place: string;
  ts: string;
  zone: string;
}

export default function ValidateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const { data: assignment } = useAssignment(id);
  const submit = useSubmitValidation();

  const [hasCongestion, setHasCongestion] = useState(false);
  const [severity, setSeverity] = useState<Severity>('none');
  const [vehicleType, setVehicleType] = useState('');
  const [count, setCount] = useState('');
  const [opinion, setOpinion] = useState('');
  const [notes, setNotes] = useState('');

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPhase, setCameraPhase] = useState<'preview' | 'review'>('preview');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [rawUri, setRawUri] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [stampInfo, setStampInfo] = useState<StampInfo | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const stampedViewRef = useRef<View>(null);

  async function openCameraModal() {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Camera required', 'Enable camera permission to take GPS photo.');
        return;
      }
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 0, lng = 0, place = '';
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
        try {
          const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          place = [geo[0]?.street, geo[0]?.district, geo[0]?.city].filter(Boolean).join(', ');
        } catch {}
      }
      setStampInfo({
        lat,
        lng,
        place,
        ts: format(new Date(), 'dd MMM yyyy HH:mm:ss'),
        zone: assignment?.cell.h3_index.slice(-6).toUpperCase() ?? '',
      });
    } catch {
      setStampInfo({ lat: 0, lng: 0, place: '', ts: format(new Date(), 'dd MMM yyyy HH:mm:ss'), zone: assignment?.cell.h3_index.slice(-6).toUpperCase() ?? '' });
    }
    setCameraPhase('preview');
    setRawUri(null);
    setCameraOpen(true);
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: false });
      setRawUri(photo.uri);
      setCameraPhase('review');
    } catch (e) {
      Alert.alert('Capture failed', (e as Error).message);
    }
  }

  async function handleUsePhoto() {
    if (!rawUri) return;
    setUploading(true);
    try {
      let finalUri = rawUri;
      // Burn GPS stamp into image on native via ViewShot
      if (Platform.OS !== 'web' && stampedViewRef.current) {
        try {
          finalUri = await captureRef(stampedViewRef, { format: 'jpg', quality: 0.9 });
        } catch {
          // ViewShot failed — fall back to raw photo
        }
      }
      const compressed = await ImageManipulator.manipulateAsync(
        finalUri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      const result = await uploadPhoto(compressed.uri, token);
      setPhotoUrl(result.url);
      setCameraOpen(false);
    } catch (e) {
      Alert.alert('Upload failed', (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!assignment) return;
    // All fields are compulsory — this report feeds monthly model retraining.
    if (!photoUrl) return Alert.alert('Photo required', 'Capture a GPS photo before submitting.');
    if (hasCongestion && severity === 'none') return Alert.alert('Severity required', 'Select a congestion severity.');
    if (!vehicleType.trim()) return Alert.alert('Vehicle type required', 'Enter the dominant vehicle type.');
    const countNum = parseInt(count, 10);
    if (!count.trim() || isNaN(countNum)) return Alert.alert('Count required', 'Enter an approximate vehicle count.');
    if (!opinion.trim()) return Alert.alert('Opinion required', 'Add your assessment of the zone.');

    // Capture current coordinates (fall back to the GPS-photo stamp).
    let latitude = stampInfo?.lat ?? 0;
    let longitude = stampInfo?.lng ?? 0;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
    } catch { /* keep stamp coords */ }

    submit.mutate({
      assignment_id: assignment.id,
      cell_id: assignment.cell_id,
      has_congestion: hasCongestion,
      congestion_severity: hasCongestion ? severity : 'none',
      dominant_vehicle_type: vehicleType.trim(),
      vehicle_count_approx: countNum,
      opinion: opinion.trim(),
      latitude,
      longitude,
      photo_url: photoUrl,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    }, {
      onSuccess: () => {
        Alert.alert('Report submitted', 'Field report saved. Assignment marked completed.', [
          { text: 'Done', onPress: () => router.replace('/(tabs)') },
        ]);
      },
      onError: (e) => Alert.alert('Error', e.message),
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <ScreenHeader title="Field Report" subtitle="Record your on-ground findings" onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >

          {/* GPS Photo — required */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>GPS Photo <Text style={styles.required}>*</Text></Text>
            {photoUrl ? (
              <View>
                <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" />
                <Pressable style={styles.retakeBtn} onPress={openCameraModal}>
                  <Ionicons name="camera-outline" size={16} color={colors.primary} />
                  <Text style={styles.retakeBtnText}>Retake photo</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.cameraCapture} onPress={openCameraModal}>
                <View style={styles.cameraCaptureIcon}>
                  <Ionicons name="camera" size={28} color={colors.primary} />
                </View>
                <Text style={styles.cameraCaptureTitle}>Capture GPS photo</Text>
                <Text style={styles.cameraCaptureSubtitle}>Location stamp will be visible on the photo</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Congestion</Text>
            <ToggleRow style={styles.toggleRow} value={hasCongestion} onValueChange={setHasCongestion}>
              <View style={styles.toggleLeft}>
                <View style={[styles.toggleIcon, { backgroundColor: (hasCongestion ? colors.risk.high : colors.risk.low) + '14' }]}>
                  <Ionicons name={hasCongestion ? 'car-sport' : 'checkmark-circle'} size={20} color={hasCongestion ? colors.risk.high : colors.risk.low} />
                </View>
                <Text style={styles.toggleLabel}>Congestion observed</Text>
              </View>
              <ToggleSwitch value={hasCongestion} onValueChange={setHasCongestion} />
            </ToggleRow>

            {hasCongestion && (
              <>
                <Text style={styles.subLabel}>Severity</Text>
                <SegmentedSlider
                  options={SEVERITY_OPTIONS}
                  value={severity}
                  onChange={setSeverity}
                  colorFor={(s) => SEVERITY_COLOR[s]}
                />
              </>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Traffic details <Text style={styles.required}>*</Text></Text>
            <Field label="Dominant vehicle type" icon="bus-outline" value={vehicleType} onChangeText={setVehicleType} placeholder="e.g. two-wheeler, auto, bus" />
            <Field label="Approximate vehicle count" icon="calculator-outline" value={count} onChangeText={setCount} placeholder="e.g. 120" keyboardType="number-pad" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your assessment <Text style={styles.required}>*</Text></Text>
            <Field
              label="Officer opinion"
              icon="chatbox-ellipses-outline"
              value={opinion}
              onChangeText={setOpinion}
              placeholder="Your judgement: is enforcement needed here? why?"
              multiline
              numberOfLines={3}
              style={{ minHeight: 70, textAlignVertical: 'top', paddingTop: spacing.sm }}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Notes</Text>
            <Field
              label="Additional observations (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything notable about the zone…"
              multiline
              numberOfLines={4}
              style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.sm }}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {!photoUrl && (
            <Text style={styles.photoError}>Photo required before submitting</Text>
          )}
          <Button
            title="Submit field report"
            icon="checkmark-done"
            onPress={handleSubmit}
            loading={submit.isPending}
            disabled={!photoUrl}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Camera Modal */}
      <Modal visible={cameraOpen} animationType="slide" statusBarTranslucent>
        <View style={styles.cameraModal}>
          {cameraPhase === 'preview' ? (
            // CameraView must have no children — expo-camera warns and can render
            // inconsistently. The overlay is an absolutely positioned sibling.
            <>
              <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {/* GPS stamp overlay on live preview */}
                {stampInfo && <GpsStamp info={stampInfo} />}
                <SafeAreaView style={styles.cameraUI} edges={['top', 'bottom']}>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setCameraOpen(false)}>
                    <Ionicons name="close" size={28} color={colors.white} />
                  </TouchableOpacity>
                  <View style={styles.shutterRow}>
                    <TouchableOpacity style={styles.shutter} onPress={handleCapture}>
                      <View style={styles.shutterInner} />
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              </View>
            </>
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <View ref={stampedViewRef} style={StyleSheet.absoluteFill} collapsable={false}>
                {rawUri && (
                  <Image source={{ uri: rawUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                )}
                {stampInfo && <GpsStamp info={stampInfo} />}
              </View>
              <SafeAreaView style={styles.cameraUI} edges={['top', 'bottom']}>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setCameraPhase('preview')}>
                  <Ionicons name="arrow-back" size={28} color={colors.white} />
                </TouchableOpacity>
                <View style={styles.reviewBtns}>
                  <TouchableOpacity style={styles.retakeShutter} onPress={() => setCameraPhase('preview')}>
                    <Ionicons name="refresh" size={22} color={colors.white} />
                    <Text style={styles.reviewBtnText}>Retake</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.usePhotoBtn, uploading && { opacity: 0.7 }]}
                    onPress={handleUsePhoto}
                    disabled={uploading}
                  >
                    {uploading
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name="checkmark" size={22} color={colors.primary} />
                    }
                    <Text style={styles.usePhotoBtnText}>{uploading ? 'Uploading…' : 'Use photo'}</Text>
                  </TouchableOpacity>
                </View>
              </SafeAreaView>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function GpsStamp({ info }: { info: StampInfo }) {
  return (
    <View style={gpsStyles.container}>
      <Text style={gpsStyles.ts}>{info.ts}</Text>
      {info.place ? <Text style={gpsStyles.place} numberOfLines={1}>{info.place}</Text> : null}
      <Text style={gpsStyles.coords}>
        {info.lat !== 0 ? `${info.lat.toFixed(6)}, ${info.lng.toFixed(6)}` : 'GPS acquiring…'}
      </Text>
      {info.zone ? <Text style={gpsStyles.zone}>Zone {info.zone}</Text> : null}
    </View>
  );
}

const gpsStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  ts: { color: colors.accent, fontSize: 11, fontWeight: '600', fontVariant: ['tabular-nums'] },
  place: { color: colors.white, fontSize: 12, fontWeight: '500' },
  coords: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontFamily: 'Courier New', fontVariant: ['tabular-nums'] },
  zone: { color: 'rgba(255,255,255,0.6)', fontSize: 10 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadow.sm,
  },
  cardTitle: { ...type.h3, color: colors.text, marginBottom: 2 },
  required: { color: colors.risk.high },
  photoPreview: {
    width: '100%',
    height: 200,
    borderRadius: radius.md,
  },
  retakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  retakeBtnText: { ...type.label, color: colors.primary },
  cameraCapture: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.md,
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cameraCaptureIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCaptureTitle: { ...type.bodyStrong, color: colors.text },
  cameraCaptureSubtitle: { ...type.caption, color: colors.textMuted, textAlign: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  toggleLabel: { ...type.bodyStrong, color: colors.text },
  subLabel: { ...type.label, color: colors.text, marginTop: spacing.sm, marginBottom: spacing.xs },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  photoError: { ...type.caption, color: colors.risk.high, textAlign: 'center' },
  // Camera modal
  cameraModal: { flex: 1, backgroundColor: '#000' },
  cameraUI: { flex: 1, justifyContent: 'space-between' },
  closeBtn: {
    margin: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRow: { alignItems: 'center', paddingBottom: spacing.lg },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.white,
  },
  reviewBtns: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    justifyContent: 'center',
  },
  retakeShutter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reviewBtnText: { color: colors.white, ...type.bodyStrong },
  usePhotoBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  usePhotoBtnText: { color: colors.primary, ...type.bodyStrong },
});

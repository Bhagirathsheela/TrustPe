/**
 * SelfieRecorder — modal-based 5-second front-camera video recorder.
 *
 * Uses expo-camera's `recordAsync({ maxDuration: 5 })` which DOES enforce the
 * 5-second limit on both Android and iOS (unlike ImagePicker's
 * `videoMaxDuration` which is iOS-only). When the duration is reached, the
 * recording auto-stops, the promise resolves with the video URI, and we
 * dismiss the modal back to the KYC wizard which then auto-advances to review.
 *
 * Permissions: needs CAMERA + RECORD_AUDIO. The expo-camera config plugin
 * (in app.json) handles the runtime prompts on first use.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  type CameraView as CameraViewRef,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { colors, radii, spacing } from '../constants/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string, mimeType: string) => void;
};

const MAX_DURATION_SEC = 5;

export function SelfieRecorder({ visible, onClose, onCapture }: Props) {
  const cameraRef = useRef<CameraViewRef | null>(null);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const [micPerm, requestMicPerm] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);
  const [count, setCount] = useState(MAX_DURATION_SEC);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup any running timer when the component unmounts or closes.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Re-request permissions if the user opens the recorder before granting.
  useEffect(() => {
    if (!visible) return;
    if (camPerm && !camPerm.granted) void requestCamPerm();
    if (micPerm && !micPerm.granted) void requestMicPerm();
  }, [visible, camPerm, micPerm, requestCamPerm, requestMicPerm]);

  const startRecording = async () => {
    if (!cameraRef.current || recording) return;
    if (!camPerm?.granted || !micPerm?.granted) {
      Alert.alert(
        'Permissions needed',
        'Allow camera and microphone access so we can record the selfie video.',
      );
      return;
    }

    setRecording(true);
    setCount(MAX_DURATION_SEC);

    // Visual countdown — the recordAsync below enforces the actual duration.
    tickRef.current = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          if (tickRef.current) clearInterval(tickRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: MAX_DURATION_SEC,
      });
      if (result?.uri) {
        onCapture(result.uri, 'video/mp4');
      }
    } catch (err) {
      Alert.alert(
        'Recording failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setRecording(false);
      if (tickRef.current) clearInterval(tickRef.current);
    }
  };

  if (!visible) return null;

  // Permission gate.
  if (!camPerm?.granted || !micPerm?.granted) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.permRoot}>
          <Text style={styles.permTitle}>Camera + microphone needed</Text>
          <Text style={styles.permBody}>
            We need camera and microphone access to record your 5-second selfie video for KYC.
          </Text>
          <Pressable
            style={[styles.button, styles.buttonPrimary]}
            onPress={() => {
              void requestCamPerm();
              void requestMicPerm();
            }}
          >
            <Text style={styles.buttonText}>Grant access</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.buttonGhost]} onPress={onClose}>
            <Text style={[styles.buttonText, { color: colors.inkMuted }]}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.root}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          mode="video"
        />

        {/* Close button (only when not recording) */}
        {!recording ? (
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        ) : null}

        {/* Recording indicator + countdown */}
        {recording ? (
          <View style={styles.recIndicator}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>{count}s</Text>
          </View>
        ) : (
          <View style={styles.tip}>
            <Text style={styles.tipText}>
              Look at the camera. Slowly turn your head left, then right.
            </Text>
            <Text style={styles.tipHint}>Recording auto-stops at 5 seconds.</Text>
          </View>
        )}

        {/* Record / stop button */}
        <View style={styles.recordBar}>
          {recording ? (
            <View style={styles.recordingPill}>
              <Text style={styles.recordingPillText}>Recording…</Text>
            </View>
          ) : (
            <Pressable
              onPress={startRecording}
              style={({ pressed }) => [
                styles.recordButton,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Start recording"
            >
              <View style={styles.recordInner} />
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  camera: { ...StyleSheet.absoluteFillObject },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: 'white', fontSize: 22, fontWeight: '600' },
  tip: {
    position: 'absolute',
    top: 70,
    left: 24,
    right: 24,
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.md,
  },
  tipText: { color: 'white', fontSize: 16, lineHeight: 22 },
  tipHint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: spacing.sm },
  recIndicator: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    gap: spacing.sm,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'white' },
  recText: { color: 'white', fontSize: 18, fontWeight: '700' },
  recordBar: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  recordButton: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 4,
    borderColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.danger,
  },
  recordingPill: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: 'white',
    borderRadius: radii.pill,
  },
  recordingPillText: { color: colors.danger, fontWeight: '700', fontSize: 16 },
  permRoot: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  permBody: {
    fontSize: 15,
    color: colors.inkMuted,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  button: {
    width: '100%',
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 16 },
});

/**
 * KYC capture wizard — four-step flow:
 *   1. Aadhaar front photo
 *   2. Aadhaar back photo
 *   3. PAN front photo
 *   4. Selfie video (5–10 seconds)
 *   5. Review + PAN/bank entry + submit
 *
 * Each capture uses Expo ImagePicker (camera). Uploads happen on the review
 * step so users can retake without burning uploads on each retry. On submit,
 * backend moves user.status to 'pending_review' and admin reviews in the
 * admin panel.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  kycSubmissionSchema,
  panSchema,
  vpaSchema,
  type KycSubmissionInput,
} from 'trustpe-shared';
import { Screen } from '../../components/Screen';
import { Heading } from '../../components/Heading';
import { BodyText } from '../../components/BodyText';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { BackHeader } from '../../components/BackHeader';
import { SelfieRecorder } from '../../components/SelfieRecorder';
import { colors, radii, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth-context';
import { uploadToCloudinary } from '../../lib/cloudinary';
import { ApiError } from '../../lib/api';
import { optimizeImageForUpload } from '../../lib/image-optimizer';
import { z } from 'zod';

type Step = 'intro' | 'aadhaar_front' | 'aadhaar_back' | 'pan_front' | 'selfie' | 'review';

type CapturedMedia = {
  uri: string;
  mimeType: string;
  type: 'image' | 'video';
};

const STEP_ORDER: Step[] = [
  'intro',
  'aadhaar_front',
  'aadhaar_back',
  'pan_front',
  'selfie',
  'review',
];

const STEP_TITLES: Record<Step, string> = {
  intro: 'KYC verification',
  aadhaar_front: 'Aadhaar — front side',
  aadhaar_back: 'Aadhaar — back side',
  pan_front: 'PAN card — front side',
  selfie: 'Quick selfie video',
  review: 'Review and submit',
};

const STEP_DESCRIPTIONS: Record<Step, string> = {
  intro:
    "We'll capture four things: front + back of your Aadhaar, your PAN card, and a 5-second selfie video. After that you'll add your PAN number and UPI ID. Takes about 2 minutes.",
  aadhaar_front:
    'Hold your Aadhaar card so the front (with photo + 12-digit number) is clear and well-lit. Use the camera button below.',
  aadhaar_back:
    'Now flip your Aadhaar over. The back side has your address. Make sure all text is readable.',
  pan_front:
    'Capture the front of your PAN card. Your 10-character PAN number must be visible and sharp.',
  selfie:
    'Record a 5-second video of your face. Look directly at the camera and slowly turn your head left, then right. This verifies you match the photo on your Aadhaar.',
  review:
    'Review your captures, fill in your PAN number and UPI ID, then submit. The TrustPe team reviews each submission personally — your UPI ID is verified by a free name-lookup in our UPI app during review.',
};

// Subset schema for the review step's form (the four cloudinary IDs come from state).
// We deliberately do NOT collect the Aadhaar number — Aadhaar Act §29 forbids
// non-KUA entities from storing it, and the admin can verify the number from
// the uploaded Aadhaar image via UIDAI's public verify portal.
//
// VPA (UPI ID) is bound here instead of in a separate UPI registration step.
// Admin verifies the VPA via a free NPCI name-lookup in their own UPI app
// during KYC review. See docs/ONBOARDING_FLOW.md.
const reviewFormSchema = z.object({
  pan: panSchema,
  vpa: vpaSchema,
});
type ReviewFormInput = z.infer<typeof reviewFormSchema>;

export default function KycWizard() {
  const { apiCall, refreshMe } = useAuth();

  const [step, setStep] = useState<Step>('intro');
  const [aadhaarFront, setAadhaarFront] = useState<CapturedMedia | null>(null);
  const [aadhaarBack, setAadhaarBack] = useState<CapturedMedia | null>(null);
  const [panFront, setPanFront] = useState<CapturedMedia | null>(null);
  const [selfie, setSelfie] = useState<CapturedMedia | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  // DPDP Act consent — explicit, recorded, withdrawable. Required before
  // KYC documents (Aadhaar image, PAN, selfie video, VPA) leave the device.
  const [kycConsentGiven, setKycConsentGiven] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ReviewFormInput>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: { pan: '', vpa: '' },
    mode: 'onBlur',
  });

  const [selfieRecorderOpen, setSelfieRecorderOpen] = useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);
  const goNext = () => {
    const next = STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  };
  const goPrev = () => {
    const prev = STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  };

  // Capture handlers — Expo ImagePicker with camera.
  // After capture we run the still through expo-image-manipulator to resize
  // to 1600px wide and 70% JPEG quality. Cuts the file from 3–8 MB → ~300 KB
  // without hurting OCR/admin readability.
  const captureImage = async (setter: (m: CapturedMedia) => void) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Camera permission needed',
        'Please allow camera access so we can capture your KYC documents.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1, // capture full quality; we re-compress below
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const optimized = await optimizeImageForUpload(asset.uri);
      setter({
        uri: optimized.uri,
        mimeType: optimized.mimeType,
        type: 'image',
      });
    }
  };

  // Selfie capture now uses our custom SelfieRecorder (expo-camera with
  // recordAsync({ maxDuration: 5 })) instead of ImagePicker, because
  // ImagePicker's videoMaxDuration is iOS-only and Android lets users record
  // forever. The SelfieRecorder enforces the 5-second limit on both platforms.
  const handleSelfieCaptured = (uri: string, mimeType: string) => {
    setSelfie({ uri, mimeType, type: 'video' });
    setSelfieRecorderOpen(false);
    // Auto-advance to review since selfie is the last capture step.
    setTimeout(() => setStep('review'), 350);
  };

  const onSubmit = async (form: ReviewFormInput) => {
    if (!aadhaarFront || !aadhaarBack || !panFront || !selfie) {
      Alert.alert(
        'Missing captures',
        'Please complete all four captures before submitting.',
      );
      return;
    }
    setSubmitting(true);
    try {
      setUploadProgress('Uploading Aadhaar front…');
      const af = await uploadToCloudinary(
        aadhaarFront.uri,
        aadhaarFront.mimeType,
        'trustpe-kyc-aadhaar',
        apiCall,
      );

      setUploadProgress('Uploading Aadhaar back…');
      const ab = await uploadToCloudinary(
        aadhaarBack.uri,
        aadhaarBack.mimeType,
        'trustpe-kyc-aadhaar',
        apiCall,
      );

      setUploadProgress('Uploading PAN…');
      const pf = await uploadToCloudinary(
        panFront.uri,
        panFront.mimeType,
        'trustpe-kyc-pan',
        apiCall,
      );

      setUploadProgress('Uploading selfie video…');
      const sv = await uploadToCloudinary(
        selfie.uri,
        selfie.mimeType,
        'trustpe-kyc-selfie',
        apiCall,
      );

      setUploadProgress('Submitting to TrustPe…');
      const payload: KycSubmissionInput = {
        pan: form.pan,
        aadhaarFrontCloudinaryId: af.publicId,
        aadhaarBackCloudinaryId: ab.publicId,
        panFrontCloudinaryId: pf.publicId,
        selfieVideoCloudinaryId: sv.publicId,
        vpa: form.vpa.toLowerCase(),
      };
      // Validate one more time against the shared schema before sending
      kycSubmissionSchema.parse(payload);

      await apiCall({ path: '/me/kyc', method: 'POST', body: payload });
      await refreshMe();
      router.replace('/home');
    } catch (err) {
      // Surface the underlying fetch cause for debugging — ApiError.details.cause
      // contains the original error string (e.g., "Network request failed").
      let message: string;
      if (err instanceof ApiError) {
        const cause =
          err.details && typeof err.details === 'object' && 'cause' in err.details
            ? String((err.details as { cause: unknown }).cause)
            : null;
        message = cause ? `${err.message}\n\nDetails: ${cause}` : err.message;
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = 'Something went wrong. Please try again.';
      }
      // eslint-disable-next-line no-console
      console.warn('[KYC submit]', err);
      Alert.alert("Couldn't submit KYC", message);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------

  if (step === 'intro') {
    return (
      <Screen scroll>
        <BackHeader fallback="/home" label="← Maybe later" />
        <Heading>{STEP_TITLES[step]}</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          {STEP_DESCRIPTIONS[step]}
        </BodyText>
        <StepChecklistCard />
        <BodyText variant="caption" color={colors.inkMuted} style={{ marginVertical: spacing.lg }}>
          We never collect or store your Aadhaar number. Your documents are encrypted in
          transit and at rest, and the team verifies your Aadhaar against UIDAI's official
          portal. See our Privacy Policy for details.
        </BodyText>
        <Button onPress={goNext}>Start KYC</Button>
      </Screen>
    );
  }

  if (step === 'review') {
    return (
      <Screen scroll>
        <BackHeader onPress={goPrev} label="← Back to selfie" />
        <Heading>{STEP_TITLES[step]}</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          {STEP_DESCRIPTIONS[step]}
        </BodyText>

        <Heading level="h3">Your captures</Heading>
        <View style={styles.thumbRow}>
          <CaptureThumb label="Aadhaar front" media={aadhaarFront} onRetake={() => setStep('aadhaar_front')} />
          <CaptureThumb label="Aadhaar back" media={aadhaarBack} onRetake={() => setStep('aadhaar_back')} />
        </View>
        <View style={styles.thumbRow}>
          <CaptureThumb label="PAN front" media={panFront} onRetake={() => setStep('pan_front')} />
          <CaptureThumb label="Selfie video" media={selfie} onRetake={() => setStep('selfie')} />
        </View>

        <View style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}>
          <Heading level="h3">PAN + UPI ID for payments</Heading>
          <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
            Your PAN goes on every loan agreement you sign. Your UPI ID is how lenders disburse
            to you and how you'll pay EMIs — pick the one you actually use.
          </BodyText>
        </View>

        <Controller
          control={control}
          name="pan"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="PAN number"
              value={value}
              onChangeText={(t) => onChange(t.toUpperCase())}
              onBlur={onBlur}
              autoCapitalize="characters"
              maxLength={10}
              placeholder="ABCDE1234F"
              error={errors.pan?.message}
            />
          )}
        />

        <Controller
          control={control}
          name="vpa"
          render={({ field: { value, onChange, onBlur } }) => (
            <TextInput
              label="UPI ID"
              value={value}
              onChangeText={(t) => onChange(t.replace(/\s/g, '').toLowerCase())}
              onBlur={onBlur}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@oksbi"
              error={errors.vpa?.message}
              hint="Example: 9876543210@oksbi, name@ybl, name@axl. The team verifies your UPI ID by name-lookup during review."
            />
          )}
        />

        {uploadProgress ? (
          <View style={styles.uploadStatus}>
            <ActivityIndicator color={colors.accent} />
            <BodyText style={{ marginLeft: spacing.md }}>{uploadProgress}</BodyText>
          </View>
        ) : null}

        {/* DPDP Act consent — the explicit hook before sensitive data leaves the device. */}
        <Pressable
          onPress={() => setKycConsentGiven((v) => !v)}
          style={({ pressed }) => [
            styles.consentRow,
            kycConsentGiven && styles.consentRowOn,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.consentBox, kycConsentGiven && styles.consentBoxOn]}>
            {kycConsentGiven ? (
              <BodyText style={styles.consentTick}>✓</BodyText>
            ) : null}
          </View>
          <BodyText variant="caption" style={styles.consentText}>
            I confirm these are my own documents and consent to TrustPe storing them encrypted to
            verify my identity and bind my UPI VPA to my account. I have read the{' '}
            <BodyText
              variant="caption"
              color={colors.accent}
              onPress={() => router.push('/legal/privacy')}
            >
              Privacy Policy
            </BodyText>{' '}
            and{' '}
            <BodyText
              variant="caption"
              color={colors.accent}
              onPress={() => router.push('/legal/terms')}
            >
              Terms
            </BodyText>
            .
          </BodyText>
        </Pressable>

        <View style={{ marginTop: spacing.lg }}>
          <Button
            onPress={handleSubmit(onSubmit)}
            loading={submitting}
            disabled={!kycConsentGiven}
          >
            Submit KYC for review
          </Button>
        </View>
      </Screen>
    );
  }

  // Capture steps share the same layout
  const isImageStep = step === 'aadhaar_front' || step === 'aadhaar_back' || step === 'pan_front';
  const currentMedia =
    step === 'aadhaar_front'
      ? aadhaarFront
      : step === 'aadhaar_back'
        ? aadhaarBack
        : step === 'pan_front'
          ? panFront
          : selfie;
  const setCurrentMedia =
    step === 'aadhaar_front'
      ? setAadhaarFront
      : step === 'aadhaar_back'
        ? setAadhaarBack
        : step === 'pan_front'
          ? setPanFront
          : setSelfie;
  const capture = isImageStep
    ? () => captureImage(setCurrentMedia)
    : () => setSelfieRecorderOpen(true);

  return (
    <Screen scroll>
      <BackHeader onPress={goPrev} />
      <ProgressDots current={stepIndex} total={STEP_ORDER.length} />
      <Heading style={{ marginTop: spacing.lg }}>{STEP_TITLES[step]}</Heading>
      <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        {STEP_DESCRIPTIONS[step]}
      </BodyText>

      <CaptureArea media={currentMedia} onCapture={capture} isImageStep={isImageStep} />

      <View style={{ marginTop: spacing.lg }}>
        <Button onPress={goNext} disabled={!currentMedia} variant={currentMedia ? 'primary' : 'secondary'}>
          Continue
        </Button>
      </View>

      <SelfieRecorder
        visible={selfieRecorderOpen}
        onClose={() => setSelfieRecorderOpen(false)}
        onCapture={handleSelfieCaptured}
      />
    </Screen>
  );
}

// -----------------------------------------------------------------------------
// Small helper components
// -----------------------------------------------------------------------------

/**
 * Single tappable capture area.
 *   - Empty: shows a centred camera icon + "Tap to open camera" / "Tap to record video".
 *   - Filled: shows the image/video. A small refresh icon overlays the top-right
 *     for retake.
 */
function CaptureArea({
  media,
  onCapture,
  isImageStep,
}: {
  media: CapturedMedia | null;
  onCapture: () => void;
  isImageStep: boolean;
}) {
  if (!media) {
    return (
      <Pressable
        onPress={onCapture}
        style={({ pressed }) => [
          styles.placeholderPreview,
          pressed && { backgroundColor: colors.paper, borderColor: colors.accent },
        ]}
        accessibilityRole="button"
        accessibilityLabel={isImageStep ? 'Open camera' : 'Record video'}
      >
        <Text style={styles.cameraGlyph}>{isImageStep ? '📷' : '🎥'}</Text>
        <BodyText color={colors.accent} style={{ fontWeight: '600' }}>
          {isImageStep ? 'Tap to open camera' : 'Tap to record video'}
        </BodyText>
        <BodyText variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
          {isImageStep ? 'Make sure all text is readable' : '5-second video'}
        </BodyText>
      </Pressable>
    );
  }

  return (
    <View style={styles.preview}>
      {media.type === 'image' ? (
        <Image source={{ uri: media.uri }} style={styles.previewMedia} resizeMode="contain" />
      ) : (
        <Video
          source={{ uri: media.uri }}
          style={styles.previewMedia}
          resizeMode={ResizeMode.CONTAIN}
          useNativeControls
          isLooping
        />
      )}
      <Pressable
        onPress={onCapture}
        style={({ pressed }) => [styles.retakeFab, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel="Retake"
      >
        <Text style={styles.retakeGlyph}>↻</Text>
      </Pressable>
    </View>
  );
}

function StepChecklistCard() {
  return (
    <View style={styles.checklist}>
      {[
        'Aadhaar — front side',
        'Aadhaar — back side',
        'PAN card — front side',
        'Selfie video (5 sec)',
      ].map((label) => (
        <View key={label} style={styles.checklistRow}>
          <View style={styles.checklistDot} />
          <BodyText>{label}</BodyText>
        </View>
      ))}
    </View>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total - 1 }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i < current ? colors.accent : colors.border },
          ]}
        />
      ))}
    </View>
  );
}

function CaptureThumb({
  label,
  media,
  onRetake,
}: {
  label: string;
  media: CapturedMedia | null;
  onRetake: () => void;
}) {
  return (
    <Pressable style={styles.thumb} onPress={onRetake} accessibilityRole="button">
      {media ? (
        media.type === 'image' ? (
          <Image source={{ uri: media.uri }} style={styles.thumbImage} resizeMode="cover" />
        ) : (
          <View style={[styles.thumbImage, styles.videoBadge]}>
            <BodyText color={colors.white}>▶ Video</BodyText>
          </View>
        )
      ) : (
        <View style={[styles.thumbImage, styles.thumbEmpty]}>
          <BodyText variant="caption" color={colors.danger}>
            Missing
          </BodyText>
        </View>
      )}
      <BodyText variant="caption" color={colors.inkMuted} align="center" style={{ marginTop: spacing.xs }}>
        {label}
      </BodyText>
      <BodyText variant="caption" color={colors.accent} align="center">
        Tap to retake
      </BodyText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  dot: { flex: 1, height: 4, borderRadius: 2 },
  preview: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    overflow: 'hidden',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  previewMedia: { width: '100%', height: '100%' },
  placeholderPreview: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    aspectRatio: 4 / 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  cameraGlyph: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  retakeFab: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeGlyph: {
    fontSize: 22,
    color: colors.white,
    fontWeight: '600',
  },
  checklist: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checklistDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  thumbRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  thumb: { flex: 1 },
  thumbImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radii.md,
    backgroundColor: colors.white,
  },
  thumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  videoBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  uploadStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  consentRowOn: {
    borderColor: colors.accent,
    backgroundColor: '#EFF6FF',
  },
  consentBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  consentBoxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  consentTick: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    lineHeight: 16,
  },
  consentText: { flex: 1, lineHeight: 18 },
});

// We import ScrollView even though we don't use it directly to ensure tree-shake doesn't fail
void ScrollView;

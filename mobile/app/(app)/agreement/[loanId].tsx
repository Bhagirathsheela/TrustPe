/**
 * Agreement viewer + click-wrap signer.
 *
 * Shows the canonical body text generated server-side. The Accept button
 * is **scroll-locked** — the user must scroll to the bottom of the
 * document before the button enables. This is the click-wrap pattern
 * Indian courts and IT Act §10A recognise as affirmative intent.
 *
 * On Accept tap: native confirmation dialog → POST sign with the
 * server-rendered body hash + a small device fingerprint composed from
 * expo-constants identifiers. Server captures IP + user-agent + timestamp.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';

type Signature = {
  userId: string;
  signedAt: string;
  ip?: string;
  deviceFingerprint?: string;
  bodyHash: string;
};

type Agreement = {
  id: string;
  loanId: string;
  borrowerId: string;
  lenderId: string;
  bodyText: string;
  bodyHash: string;
  status:
    | 'awaiting_signatures'
    | 'awaiting_lender'
    | 'awaiting_borrower'
    | 'signed'
    | 'void';
  borrowerSignature?: Signature;
  lenderSignature?: Signature;
  generatedAt: string;
  signedAt?: string;
};

/** Composes a small, repeatable device fingerprint from public Expo identifiers.
 *  Not cryptographic — just enough to differentiate devices in the audit log. */
function getDeviceFingerprint(): string {
  const installationId =
    (Constants.installationId as string | undefined) ??
    (Constants.sessionId as string | undefined) ??
    'unknown';
  const platform = Platform.OS;
  const platformVersion = String(Platform.Version);
  const appVersion = (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';
  return `${platform}-${platformVersion}-${appVersion}-${installationId.slice(0, 16)}`;
}

const SCROLL_BOTTOM_THRESHOLD = 24; // px

export default function AgreementScreen() {
  const params = useLocalSearchParams<{ loanId: string }>();
  const loanId = params.loanId;
  const { apiCall, user } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);

  const load = useCallback(async () => {
    if (!loanId) return;
    try {
      const data = await apiCall<Agreement>({ path: `/loans/${loanId}/agreement` });
      setAgreement(data);
    } catch (err) {
      Alert.alert(
        "Couldn't load agreement",
        err instanceof Error ? err.message : 'Unknown error',
      );
    } finally {
      setLoading(false);
    }
  }, [apiCall, loanId]);

  useEffect(() => {
    void load();
  }, [load]);

  const role = useMemo<'borrower' | 'lender' | null>(() => {
    if (!agreement || !user) return null;
    if (user.id === agreement.borrowerId) return 'borrower';
    if (user.id === agreement.lenderId) return 'lender';
    return null;
  }, [agreement, user]);

  const alreadySigned = useMemo(() => {
    if (!agreement || !role) return false;
    return role === 'borrower'
      ? Boolean(agreement.borrowerSignature)
      : Boolean(agreement.lenderSignature);
  }, [agreement, role]);

  const otherSigned = useMemo(() => {
    if (!agreement || !role) return false;
    return role === 'borrower'
      ? Boolean(agreement.lenderSignature)
      : Boolean(agreement.borrowerSignature);
  }, [agreement, role]);

  const fullySigned = agreement?.status === 'signed';

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const remaining = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (remaining <= SCROLL_BOTTOM_THRESHOLD && !scrolledToEnd) {
      setScrolledToEnd(true);
    }
  }, [scrolledToEnd]);

  const onAcceptPress = useCallback(() => {
    if (!agreement) return;
    Alert.alert(
      'Sign this agreement?',
      'Tapping "Sign" records your signature with your IP, device, and timestamp. This is a legally binding electronic signature under §10A of the IT Act, 2000.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign',
          style: 'destructive',
          onPress: async () => {
            setSigning(true);
            try {
              const updated = await apiCall<Agreement>({
                path: `/loans/${agreement.loanId}/agreement/sign`,
                method: 'POST',
                body: {
                  deviceFingerprint: getDeviceFingerprint(),
                  expectedBodyHash: agreement.bodyHash,
                },
              });
              setAgreement(updated);
              Alert.alert(
                'Signed',
                updated.status === 'signed'
                  ? 'Both parties have signed. The loan can now move to disbursal.'
                  : "Your signature is recorded. We'll notify you when the other party signs.",
              );
            } catch (err) {
              Alert.alert(
                "Couldn't sign",
                err instanceof ApiError ? err.message : 'Try again.',
              );
            } finally {
              setSigning(false);
            }
          },
        },
      ],
    );
  }, [agreement, apiCall]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Loading…</BodyText>
        </View>
      </SafeAreaView>
    );
  }
  if (!agreement) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Agreement not found.</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackHeader fallback={`/loans/${agreement.loanId}`} />
        <Heading level="h3">Loan agreement</Heading>
        <BodyText variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.xs }}>
          Document hash · {agreement.bodyHash.slice(0, 16)}…
        </BodyText>
      </View>

      <StatusBanner
        role={role}
        alreadySigned={alreadySigned}
        otherSigned={otherSigned}
        fullySigned={fullySigned}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        onScroll={onScroll}
        scrollEventThrottle={64}
      >
        <View style={styles.documentCard}>
          <BodyText style={styles.documentText}>{agreement.bodyText}</BodyText>
        </View>

        <SignatureBlock
          label="Borrower"
          signature={agreement.borrowerSignature}
          you={role === 'borrower'}
        />
        <SignatureBlock
          label="Lender"
          signature={agreement.lenderSignature}
          you={role === 'lender'}
        />

        <BodyText variant="caption" color={colors.inkMuted} align="center" style={styles.bottomPad}>
          Scroll to the end to enable the Accept button.
        </BodyText>
      </ScrollView>

      {!alreadySigned && !fullySigned ? (
        <View style={styles.signBar}>
          <Button
            onPress={onAcceptPress}
            loading={signing}
            disabled={!scrolledToEnd}
            variant={scrolledToEnd ? 'primary' : 'secondary'}
          >
            {scrolledToEnd ? 'Accept and sign' : 'Scroll to the end to enable signing'}
          </Button>
        </View>
      ) : alreadySigned && !fullySigned ? (
        <View style={styles.signBar}>
          <Button variant="secondary" onPress={() => router.push(`/chat/${agreement.loanId}`)}>
            You signed. Nudge the other party via chat
          </Button>
        </View>
      ) : (
        <View style={styles.signBar}>
          <Button onPress={() => router.push(`/loans/${agreement.loanId}`)}>
            Back to loan
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

function StatusBanner({
  role,
  alreadySigned,
  otherSigned,
  fullySigned,
}: {
  role: 'borrower' | 'lender' | null;
  alreadySigned: boolean;
  otherSigned: boolean;
  fullySigned: boolean;
}) {
  let bg = '#FFFBEB';
  let ink = '#92400E';
  let copy = '';
  if (fullySigned) {
    bg = '#ECFDF5';
    ink = '#065F46';
    copy = '✓ Signed by both parties. Awaiting disbursal.';
  } else if (alreadySigned && !otherSigned) {
    bg = '#EFF6FF';
    ink = '#1E40AF';
    copy = `You signed. Waiting for the ${role === 'borrower' ? 'lender' : 'borrower'} to sign.`;
  } else if (!alreadySigned && otherSigned) {
    bg = '#FFFBEB';
    ink = '#92400E';
    copy = `The ${role === 'borrower' ? 'lender' : 'borrower'} signed. Your signature is needed to proceed.`;
  } else {
    bg = '#FFFBEB';
    ink = '#92400E';
    copy = 'Neither party has signed yet. Read the agreement below and sign at the bottom.';
  }
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <BodyText style={[styles.bannerText, { color: ink }]}>{copy}</BodyText>
    </View>
  );
}

function SignatureBlock({
  label,
  signature,
  you,
}: {
  label: string;
  signature?: Signature;
  you: boolean;
}) {
  return (
    <View style={styles.sigBlock}>
      <BodyText variant="caption" color={colors.inkMuted}>
        {label.toUpperCase()}
        {you ? ' · YOU' : ''}
      </BodyText>
      {signature ? (
        <>
          <BodyText style={{ marginTop: spacing.xs, fontWeight: '600' }}>
            ✓ Signed on {new Date(signature.signedAt).toLocaleString()}
          </BodyText>
          <BodyText variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>
            Hash {signature.bodyHash.slice(0, 16)}…{' '}
            {signature.ip ? `· IP ${signature.ip}` : ''}
          </BodyText>
        </>
      ) : (
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs, fontStyle: 'italic' }}>
          Not signed yet
        </BodyText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  banner: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  bannerText: { fontSize: 13, fontWeight: '600' },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  documentCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  documentText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
  },
  sigBlock: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  bottomPad: { marginTop: spacing.xl, marginBottom: spacing.md },
  signBar: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
});

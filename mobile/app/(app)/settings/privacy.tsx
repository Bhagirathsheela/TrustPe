/**
 * Privacy controls — DPDP §11–14 rights.
 *
 * Two actions:
 *   1. Request export — hits GET /me/export, saves the JSON to the
 *      device's Downloads directory via expo-file-system + expo-sharing.
 *   2. Delete account — a two-step confirm (precheck → confirm typing
 *      "DELETE") that runs POST /me/delete-account. If there are live
 *      loans blocking deletion, we show a friendly explainer instead.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { TextInput } from '../../../components/TextInput';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';
import { API_BASE_URL } from '../../../lib/api-config';

type Precheck = {
  canDelete: boolean;
  blockingLoanCount: number;
  blockingLoanIds: string[];
};

export default function PrivacyControls() {
  const { user, apiCall, getAccessToken, logout } = useAuth();
  const [precheck, setPrecheck] = useState<Precheck | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await apiCall<Precheck>({ path: '/me/deletion-precheck' });
        if (!cancelled) setPrecheck(data);
      } catch {
        /* leave precheck null → we show a generic "checking…" state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiCall]);

  /**
   * Export uses a plain fetch rather than apiCall because we want the
   * raw response body (a large JSON attachment) written to a file, not
   * parsed into memory as a JSON tree.
   */
  const onExport = async () => {
    setExporting(true);
    try {
      // Refresh the session first so the token can't expire mid-download.
      await apiCall({ path: '/me' });
      const token = getAccessToken();
      if (!token) throw new Error('Not signed in.');

      const filename = `trustpe-export-${new Date().toISOString().slice(0, 10)}.json`;
      const target = `${FileSystem.documentDirectory ?? ''}${filename}`;
      const url = `${API_BASE_URL}/me/export`;
      const download = await FileSystem.downloadAsync(url, target, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (download.status < 200 || download.status >= 300) {
        throw new Error(`Export failed (HTTP ${download.status}).`);
      }
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(download.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Save your TrustPe export',
        });
      } else {
        Alert.alert('Export ready', `Saved to ${download.uri}`);
      }
    } catch (err) {
      Alert.alert(
        "Couldn't export",
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setExporting(false);
    }
  };

  const onConfirmDelete = async () => {
    if (confirmText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Type DELETE to confirm', 'This is a permanent action.');
      return;
    }
    setDeleting(true);
    try {
      await apiCall<{ deletedAt: string }>({
        path: '/me/delete-account',
        method: 'POST',
        body: { reason: reason.trim() || undefined },
      });
      Alert.alert(
        'Account deleted',
        'Your account has been suspended and marked for full purge. Audit-log entries are retained per the Privacy Policy.',
        [{ text: 'OK', onPress: () => void logout() }],
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === 'live_loans') {
        Alert.alert(
          "Can't delete just yet",
          "You have live loans on your account. Settle those first (or accept default) and try again.",
        );
      } else {
        Alert.alert(
          "Couldn't delete",
          err instanceof Error ? err.message : 'Please try again.',
        );
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback="/settings" />
        <Heading>Privacy & data</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
          Rights we honour under India&apos;s Digital Personal Data Protection Act. See our{' '}
          <BodyText
            variant="bodyMuted"
            color={colors.accent}
            onPress={() => router.push('/legal/privacy')}
          >
            Privacy Policy
          </BodyText>{' '}
          for the full text.
        </BodyText>

        {/* Export */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <BodyText style={styles.cardEmoji}>📦</BodyText>
            <View style={{ flex: 1 }}>
              <BodyText style={styles.cardTitle}>Export your data</BodyText>
              <BodyText variant="caption" color={colors.inkMuted}>
                A JSON file with your profile, KYC record, loans, offers, reviews, notifications,
                and audit trail.
              </BodyText>
            </View>
          </View>
          <BodyText variant="caption" color={colors.inkMuted} style={styles.cardBody}>
            KYC document images aren&apos;t included in the JSON — email privacy@trustpe.in with
            the export to request them.
          </BodyText>
          <View style={{ marginTop: spacing.md }}>
            <Button variant="secondary" onPress={onExport} loading={exporting}>
              Download my data
            </Button>
          </View>
        </View>

        {/* Delete */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <BodyText style={styles.cardEmoji}>🗑️</BodyText>
            <View style={{ flex: 1 }}>
              <BodyText style={styles.cardTitle}>Delete your account</BodyText>
              <BodyText variant="caption" color={colors.inkMuted}>
                Suspends immediately, then purges profile + KYC per Privacy Policy §10.
              </BodyText>
            </View>
          </View>

          {precheck === null ? (
            <BodyText variant="caption" color={colors.inkMuted} style={styles.cardBody}>
              Checking whether you can delete now…
            </BodyText>
          ) : precheck.canDelete ? (
            <>
              {!confirmOpen ? (
                <>
                  <BodyText variant="caption" color={colors.inkMuted} style={styles.cardBody}>
                    Audit-log entries are retained for 5 years per PMLA-informed policy — this is
                    non-negotiable. Everything else about {user?.name ?? 'your account'} is
                    scheduled for purge.
                  </BodyText>
                  <View style={{ marginTop: spacing.md }}>
                    <Button variant="secondary" onPress={() => setConfirmOpen(true)}>
                      I understand — start deletion
                    </Button>
                  </View>
                </>
              ) : (
                <View style={styles.confirmBlock}>
                  <BodyText style={{ fontWeight: '600', color: '#991B1B' }}>
                    Confirm account deletion
                  </BodyText>
                  <BodyText variant="caption" color="#991B1B" style={{ marginTop: spacing.xs }}>
                    Type DELETE to enable the button. This is permanent for identifying data —
                    audit log entries stay for 5 years.
                  </BodyText>
                  <View style={{ marginTop: spacing.md }}>
                    <TextInput
                      label="Type DELETE"
                      value={confirmText}
                      onChangeText={setConfirmText}
                      autoCapitalize="characters"
                    />
                  </View>
                  <View style={{ marginTop: spacing.sm }}>
                    <TextInput
                      label="Reason (optional)"
                      value={reason}
                      onChangeText={setReason}
                      multiline
                      placeholder="Helps us improve TrustPe."
                    />
                  </View>
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Confirm delete my account"
                      onPress={onConfirmDelete}
                      disabled={deleting}
                      style={({ pressed }) => [
                        styles.dangerButton,
                        pressed && { opacity: 0.85 },
                        deleting && { opacity: 0.5 },
                      ]}
                    >
                      <BodyText style={styles.dangerButtonText}>
                        {deleting ? 'Deleting…' : 'Delete my account permanently'}
                      </BodyText>
                    </Pressable>
                    <Button
                      variant="secondary"
                      onPress={() => {
                        setConfirmOpen(false);
                        setConfirmText('');
                        setReason('');
                      }}
                    >
                      Cancel
                    </Button>
                  </View>
                </View>
              )}
            </>
          ) : (
            <View style={styles.blockedBlock}>
              <BodyText style={{ fontWeight: '600', color: '#92400E' }}>
                Live loans on your account
              </BodyText>
              <BodyText variant="caption" color="#92400E" style={{ marginTop: spacing.xs }}>
                You have {precheck.blockingLoanCount} loan
                {precheck.blockingLoanCount === 1 ? '' : 's'} that must be settled (or default
                accepted) before deletion. This is to protect the counter-party.
              </BodyText>
              <View style={{ marginTop: spacing.md }}>
                <Button variant="secondary" onPress={() => router.push('/loans/mine')}>
                  Open my loans
                </Button>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  cardEmoji: { fontSize: 26 },
  cardTitle: { fontWeight: '600', fontSize: 16, color: colors.ink, marginBottom: 4 },
  cardBody: { marginTop: spacing.md, lineHeight: 18 },
  confirmBlock: {
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: radii.md,
  },
  blockedBlock: {
    marginTop: spacing.md,
    padding: spacing.lg,
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: radii.md,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    padding: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});

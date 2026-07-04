/**
 * UTR capture guide — bottom-sheet cheat card.
 *
 * Users hit this from the "Mark as paid" form when they don't know where
 * to find the 12-digit UTR in their UPI app. Covers the three apps that
 * cover ~95% of Indian UPI volume — PhonePe, Google Pay, Paytm — plus a
 * generic "search your SMS" fallback for banks that report via SMS.
 *
 * Phase 1 ships text-only steps; annotated screenshots slot in later
 * with the `screenshot` prop on each entry.
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BodyText } from './BodyText';
import { Heading } from './Heading';
import { Button } from './Button';
import { colors, radii, spacing } from '../constants/theme';

type Guide = {
  key: 'phonepe' | 'gpay' | 'paytm' | 'sms';
  emoji: string;
  name: string;
  hint: string;
  steps: string[];
};

const GUIDES: Guide[] = [
  {
    key: 'phonepe',
    emoji: '📱',
    name: 'PhonePe',
    hint: 'The 12-digit UPI reference.',
    steps: [
      'Open PhonePe and tap the History icon at the bottom.',
      'Tap the transaction you just made — the one to TrustPe / the counter-party.',
      'Scroll down to "Transaction details".',
      'Copy the number labelled "UPI Transaction ID" or "UPI Ref. No." — it\'s 12 digits.',
    ],
  },
  {
    key: 'gpay',
    emoji: '🅶',
    name: 'Google Pay',
    hint: 'Called "UPI transaction ID" here.',
    steps: [
      'Open Google Pay and tap your profile icon (top right).',
      'Tap "Activity" (or scroll down on the home screen to see recent payments).',
      'Tap the payment you just made.',
      'Copy the number under "UPI transaction ID" — 12 digits.',
    ],
  },
  {
    key: 'paytm',
    emoji: '💙',
    name: 'Paytm',
    hint: 'Under "Bank Reference No".',
    steps: [
      'Open Paytm and tap the "Balance & History" section on the home screen.',
      'Choose "UPI" and pick the payment you just made.',
      'Tap "View details".',
      'Copy the value under "Bank Reference No." (some builds label it "RRN") — 12 digits.',
    ],
  },
  {
    key: 'sms',
    emoji: '💬',
    name: 'Your bank SMS',
    hint: 'Every UPI payment triggers a bank SMS.',
    steps: [
      'Open Messages.',
      'Search for the counter-party\'s bank / VPA, or search for "UPI".',
      'Look for the reference number, RRN, or UTR in the debit / credit SMS.',
      'It\'s 12 digits and identical to the one your UPI app shows.',
    ],
  },
];

export function UtrGuideSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<Guide['key']>('phonepe');

  return (
    <Modal transparent visible={open} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Inner Pressable stops backdrop taps from bubbling through the sheet body. */}
        <Pressable style={styles.sheet}>
          <View style={styles.handle} />
          <Heading level="h2">Where's my UTR?</Heading>
          <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>
            The UTR is a 12-digit reference every UPI payment gets. It's optional here — TrustPe
            works without it — but it makes disputes much easier to resolve.
          </BodyText>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.xl }}>
            {GUIDES.map((g) => (
              <View key={g.key} style={styles.card}>
                <Pressable
                  onPress={() => setExpanded(expanded === g.key ? 'sms' : g.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.name} instructions`}
                  style={styles.cardHeader}
                >
                  <BodyText style={styles.cardEmoji}>{g.emoji}</BodyText>
                  <View style={{ flex: 1 }}>
                    <BodyText style={styles.cardTitle}>{g.name}</BodyText>
                    <BodyText variant="caption" color={colors.inkMuted}>
                      {g.hint}
                    </BodyText>
                  </View>
                  <BodyText color={colors.accent} style={styles.chevron}>
                    {expanded === g.key ? '▾' : '▸'}
                  </BodyText>
                </Pressable>

                {expanded === g.key ? (
                  <View style={styles.steps}>
                    {g.steps.map((step, idx) => (
                      <View key={idx} style={styles.stepRow}>
                        <View style={styles.stepBadge}>
                          <BodyText style={styles.stepBadgeText}>{idx + 1}</BodyText>
                        </View>
                        <BodyText style={styles.stepText}>{step}</BodyText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}

            <BodyText
              variant="caption"
              color={colors.inkMuted}
              align="center"
              style={{ marginTop: spacing.lg, lineHeight: 18 }}
            >
              Can't find it? Leave the field blank and add a note — you can attach the UTR later
              from the payment detail screen.
            </BodyText>
          </ScrollView>

          <View style={{ marginTop: spacing.md }}>
            <Button variant="secondary" onPress={onClose}>
              Close
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    maxHeight: '85%',
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    minHeight: 60,
  },
  cardEmoji: { fontSize: 24 },
  cardTitle: { fontWeight: '600', fontSize: 15, color: colors.ink },
  chevron: { fontSize: 18 },
  steps: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  stepRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, lineHeight: 22, color: colors.ink },
});

/**
 * Generic renderer for legal documents (Privacy, Terms).
 *
 * Content lives in `mobile/lib/legal/*.ts` as structured data so it can be
 * updated independently of the layout. Sections are heading + paragraphs +
 * bullets; the renderer takes care of typography and spacing.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackHeader } from './BackHeader';
import { Heading } from './Heading';
import { BodyText } from './BodyText';
import { colors, radii, spacing } from '../constants/theme';
import type { LegalSection } from '../lib/legal/privacy-policy';

export type LegalDoc = {
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
  footer: string;
};

export function LegalPage({
  title,
  doc,
  backFallback,
}: {
  title: string;
  doc: LegalDoc;
  backFallback?: string;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback={backFallback ?? '/settings'} />
        <Heading>{title}</Heading>
        <View style={styles.draftBanner}>
          <BodyText variant="caption" color="#92400E" style={styles.draftBannerText}>
            ⚠️ {doc.effectiveDate}. This is a working summary for the closed
            pilot; the canonical version is in the operator&apos;s docs and is
            pending legal review.
          </BodyText>
        </View>

        <BodyText style={styles.intro}>{doc.intro}</BodyText>

        {doc.sections.map((section, idx) => (
          <View key={idx} style={styles.section}>
            <BodyText style={styles.sectionHeading}>{section.heading}</BodyText>
            {section.paragraphs?.map((p, pIdx) => (
              <BodyText key={`p-${pIdx}`} style={styles.paragraph}>
                {p}
              </BodyText>
            ))}
            {section.bullets?.map((b, bIdx) => (
              <View key={`b-${bIdx}`} style={styles.bulletRow}>
                <BodyText style={styles.bulletDot}>•</BodyText>
                <BodyText style={styles.bulletText}>{b}</BodyText>
              </View>
            ))}
          </View>
        ))}

        <BodyText variant="caption" color={colors.inkMuted} style={styles.footerText}>
          {doc.footer}
        </BodyText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  draftBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  draftBannerText: { lineHeight: 18 },
  intro: { lineHeight: 22, marginBottom: spacing.lg, color: colors.ink },
  section: { marginBottom: spacing.lg },
  sectionHeading: {
    fontWeight: '700',
    fontSize: 16,
    marginBottom: spacing.sm,
    color: colors.ink,
  },
  paragraph: { lineHeight: 22, marginBottom: spacing.sm, color: colors.ink },
  bulletRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
    paddingRight: spacing.md,
  },
  bulletDot: { color: colors.accent, fontWeight: '700', width: 12 },
  bulletText: { flex: 1, lineHeight: 22, color: colors.ink },
  footerText: {
    marginTop: spacing.xl,
    lineHeight: 18,
  },
});

import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Heading } from '../../components/Heading';
import { BodyText } from '../../components/BodyText';
import { Button } from '../../components/Button';
import { colors, spacing } from '../../constants/theme';

export default function Welcome() {
  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Heading level="display" color={colors.white} align="center">
            T
          </Heading>
        </View>
        <Heading level="display" align="center">
          TrustPe
        </Heading>
        <BodyText variant="bodyMuted" align="center" style={styles.tagline}>
          India's trust-based peer lending circle. Borrow what you need; lend what you can.
        </BodyText>
      </View>

      <View style={styles.cta}>
        <Button onPress={() => router.push('/signup')}>Get started</Button>
        <View style={styles.spacer} />
        <Button variant="ghost" onPress={() => router.push('/login')}>
          I already have an account
        </Button>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  tagline: { marginTop: spacing.md, maxWidth: 280 },
  cta: { paddingBottom: spacing.lg },
  spacer: { height: spacing.sm },
});

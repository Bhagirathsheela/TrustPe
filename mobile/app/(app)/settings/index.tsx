/**
 * Settings — account info, notification preferences, about, logout.
 *
 * The home screen previously hosted the logout button; it now lives here so
 * the home stays focused on activity. Account info is read-only — profile
 * edits live on the profile screen.
 */
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';

export default function Settings() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    Alert.alert('Log out of TrustPe?', 'You can sign back in with your email anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } catch (err) {
            Alert.alert(
              "Couldn't log out",
              err instanceof Error ? err.message : 'Please try again.',
            );
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const appVersion =
    (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackHeader fallback="/home" />
        <Heading>Settings</Heading>

        <SectionLabel>ACCOUNT</SectionLabel>
        <View style={styles.card}>
          <Row label="Name" value={user?.name ?? '—'} />
          <Divider />
          <Row label="Email" value={user?.email ?? '—'} />
          <Divider />
          <Row label="Phone" value={user?.phone ?? '—'} />
          {user?.handle ? (
            <>
              <Divider />
              <Row label="Handle" value={`@${user.handle}`} />
            </>
          ) : null}
        </View>

        <SectionLabel>PROFILE</SectionLabel>
        <View style={styles.card}>
          <LinkRow
            label="My public profile"
            hint="What other users see"
            onPress={() => user?.id && router.push(`/users/${user.id}`)}
          />
          <Divider />
          <LinkRow
            label="Edit profile details"
            hint="City, occupation, income band"
            onPress={() => router.push('/profile')}
          />
        </View>

        <SectionLabel>NOTIFICATIONS</SectionLabel>
        <View style={styles.card}>
          <LinkRow
            label="Notification preferences"
            hint="Mute categories you don't want pings for"
            onPress={() => router.push('/settings/notifications')}
          />
          <Divider />
          <LinkRow
            label="Notification history"
            hint="Everything you've been pinged about"
            onPress={() => router.push('/notifications')}
          />
        </View>

        <SectionLabel>LEGAL</SectionLabel>
        <View style={styles.card}>
          <LinkRow
            label="Privacy policy"
            hint="What we collect and what we do with it"
            onPress={() => router.push('/legal/privacy')}
          />
          <Divider />
          <LinkRow
            label="Terms & conditions"
            hint="What TrustPe is and isn't"
            onPress={() => router.push('/legal/terms')}
          />
          <Divider />
          <LinkRow
            label="Privacy & data controls"
            hint="Export or delete your account"
            onPress={() => router.push('/settings/privacy')}
          />
        </View>

        <SectionLabel>ABOUT</SectionLabel>
        <View style={styles.card}>
          <Row label="App version" value={appVersion} />
          <Divider />
          <Row label="Backend" value="Phase 1 — closed pilot" />
          <Divider />
          <LinkRow
            label="Email support"
            hint="support@trustpe.in · we reply within 24h"
            onPress={() =>
              void Linking.openURL(
                'mailto:support@trustpe.in?subject=TrustPe%20support%20request',
              )
            }
          />
          <Divider />
          <LinkRow
            label="Report a security issue"
            hint="security@trustpe.in"
            onPress={() =>
              void Linking.openURL(
                'mailto:security@trustpe.in?subject=Security%20issue%20report',
              )
            }
          />
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Button variant="secondary" onPress={onLogout} loading={loggingOut}>
            Log out
          </Button>
        </View>

        <BodyText
          variant="caption"
          color={colors.inkMuted}
          align="center"
          style={{ marginTop: spacing.xl, marginBottom: spacing.lg }}
        >
          TrustPe is a trust-based personal lending network for invited members. Closed
          friends-and-family pilot.
        </BodyText>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <BodyText
      variant="caption"
      color={colors.inkMuted}
      style={{ marginTop: spacing.xl, marginBottom: spacing.sm, letterSpacing: 0.5 }}
    >
      {children}
    </BodyText>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <BodyText variant="caption" color={colors.inkMuted} style={{ width: 80 }}>
        {label}
      </BodyText>
      <BodyText style={{ flex: 1, fontWeight: '500' }}>{value}</BodyText>
    </View>
  );
}

function LinkRow({
  label,
  hint,
  onPress,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { backgroundColor: colors.paper }]}
    >
      <View style={{ flex: 1 }}>
        <BodyText style={{ fontWeight: '600' }}>{label}</BodyText>
        {hint ? (
          <BodyText variant="caption" color={colors.inkMuted} style={{ marginTop: 2 }}>
            {hint}
          </BodyText>
        ) : null}
      </View>
      <BodyText color={colors.accent} style={{ fontSize: 18 }}>
        ›
      </BodyText>
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.lg,
  },
});

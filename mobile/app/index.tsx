/**
 * Root route — splash that routes based on auth state.
 *
 * On launch:
 *   1. Show a spinner while auth-context bootstraps (reads SecureStore, tries refresh)
 *   2. If a valid session exists → /home
 *   3. Otherwise → /welcome
 */
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../lib/auth-context';
import { colors } from '../constants/theme';

export default function Index() {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return <Redirect href={isAuthenticated ? '/home' : '/welcome'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

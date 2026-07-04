/**
 * Authenticated route group.
 * Redirects unauthenticated users back to /welcome.
 */
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../lib/auth-context';

export default function AppLayout() {
  const { ready, isAuthenticated } = useAuth();
  if (!ready) return null;
  if (!isAuthenticated) return <Redirect href="/welcome" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}

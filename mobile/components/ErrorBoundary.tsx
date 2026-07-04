/**
 * Top-level error boundary.
 *
 * React's error boundary still requires a class component. Wraps the entire
 * app root in `_layout.tsx`. On crash:
 *   - Reports to tracker (Sentry-ready stub)
 *   - Shows a friendly fallback with three options: retry, reset to home,
 *     copy diagnostic details for support
 *
 * Note: this catches render-phase + lifecycle errors. It does NOT catch
 * errors thrown in event handlers, async code (Promises), or in the native
 * layer. Those still need explicit try/catch + tracker.captureException at
 * the call site.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View, Clipboard } from 'react-native';
import { router } from 'expo-router';
import { Heading } from './Heading';
import { BodyText } from './BodyText';
import { Button } from './Button';
import { colors, radii, spacing } from '../constants/theme';
import { tracker } from '../lib/tracker';

type State = {
  error: Error | null;
  errorInfo: ErrorInfo | null;
};

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    tracker.captureException(error, {
      componentStack: errorInfo.componentStack,
      source: 'mobile-root-error-boundary',
    });
  }

  retry = (): void => {
    this.setState({ error: null, errorInfo: null });
  };

  resetToHome = (): void => {
    this.setState({ error: null, errorInfo: null });
    try {
      router.replace('/home');
    } catch {
      /* if the router itself is the problem, retry will at least re-mount */
    }
  };

  copyDetails = (): void => {
    const { error, errorInfo } = this.state;
    const text = [
      `TrustPe crash report`,
      `When: ${new Date().toISOString()}`,
      `Message: ${error?.message ?? 'unknown'}`,
      `Stack:`,
      error?.stack ?? '(no stack)',
      `Component stack:`,
      errorInfo?.componentStack ?? '(no component stack)',
    ].join('\n');
    Clipboard.setString(text);
    Alert.alert(
      'Copied',
      'Crash details copied to clipboard. Paste them in an email to support@trustpe.in.',
    );
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.icon}>
          <BodyText style={styles.iconText}>⚠️</BodyText>
        </View>

        <Heading align="center">Something went wrong</Heading>
        <BodyText
          align="center"
          color={colors.inkMuted}
          style={{ marginTop: spacing.sm, marginBottom: spacing.xl, lineHeight: 22 }}
        >
          The app hit an unexpected error. Your data is safe — nothing was sent or saved.
          Try again, or head back to the home screen.
        </BodyText>

        <View style={{ width: '100%' }}>
          <Button onPress={this.retry}>Try again</Button>
          <View style={{ height: spacing.sm }} />
          <Button variant="secondary" onPress={this.resetToHome}>
            Go to home
          </Button>
        </View>

        <View style={styles.diagnosticsCard}>
          <BodyText variant="caption" color={colors.inkMuted}>
            DIAGNOSTIC DETAILS
          </BodyText>
          <BodyText style={styles.errorMessage}>
            {this.state.error.message || 'Unknown error'}
          </BodyText>
          <Pressable onPress={this.copyDetails} hitSlop={10}>
            <BodyText variant="caption" color={colors.accent}>
              Copy details to clipboard →
            </BodyText>
          </Pressable>
        </View>

        <BodyText
          variant="caption"
          align="center"
          color={colors.inkMuted}
          style={{ marginTop: spacing.xl }}
        >
          If this keeps happening, please email support@trustpe.in with the details above.
        </BodyText>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.paper,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  icon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconText: { fontSize: 36 },
  diagnosticsCard: {
    marginTop: spacing.xl,
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  errorMessage: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.ink,
  },
});

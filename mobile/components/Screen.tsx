/**
 * Screen — top-level page wrapper.
 *
 * Keyboard behavior:
 *   - Tap on empty space anywhere on the screen dismisses the keyboard (via
 *     TouchableWithoutFeedback). This also blurs whatever input was focused,
 *     which closes any open autocomplete suggestions inside the form.
 *   - iOS: KeyboardAvoidingView with `behavior="padding"` shifts content up.
 *   - Android: relies on `softwareKeyboardLayoutMode: "resize"` in app.json
 *     so the window resizes when the keyboard appears, allowing the inner
 *     ScrollView to scroll the focused field into view.
 *   - ScrollView uses `keyboardShouldPersistTaps="handled"` so tapping a
 *     suggestion / button doesn't lose the keyboard mid-tap.
 */
import { forwardRef, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  type ScrollView as RNScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../constants/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  centered?: boolean;
  padded?: boolean;
  /** Extra padding at the bottom of scroll content — useful so the last field
   *  can scroll above the keyboard on Android. Default 200. */
  scrollBottomPadding?: number;
  /** Tap on empty space dismisses the keyboard. Default true. Set false on
   *  screens where this would interfere with interactive backgrounds. */
  dismissKeyboardOnTap?: boolean;
};

export const Screen = forwardRef<RNScrollView, Props>(function Screen(
  {
    children,
    scroll = false,
    centered = false,
    padded = true,
    scrollBottomPadding = 200,
    dismissKeyboardOnTap = true,
  },
  scrollRef,
) {
  const innerView = (
    <View
      style={[
        styles.inner,
        padded && styles.padded,
        centered && styles.centered,
      ]}
    >
      {children}
    </View>
  );

  // Wrap in TouchableWithoutFeedback to capture taps on empty/non-interactive
  // areas. Children with their own onPress handlers (TextInput focus, Button
  // taps, suggestion-row taps) still work because RN's gesture system gives
  // the deepest responder priority.
  const inner = dismissKeyboardOnTap ? (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {innerView}
    </TouchableWithoutFeedback>
  ) : (
    innerView
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: scrollBottomPadding },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
            showsVerticalScrollIndicator={false}
          >
            {inner}
          </ScrollView>
        ) : (
          inner
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  inner: { flex: 1 },
  padded: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  centered: { justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flexGrow: 1 },
});

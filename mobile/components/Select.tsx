/**
 * Select — a tappable field that opens a modal list of options.
 *
 * Used for occupation category, income band, and other enum choices where a
 * native dropdown would feel out of place. Keyboard-driven values use TextInput;
 * fixed enums use this.
 */
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';
import { BodyText } from './BodyText';

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
};

type Props<T extends string> = {
  label?: string;
  value: T | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  error?: string;
  title?: string;
};

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  error,
  title,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View style={styles.field}>
      {label ? (
        <BodyText variant="caption" color={colors.inkMuted} style={styles.label}>
          {label.toUpperCase()}
        </BodyText>
      ) : null}

      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.input, error ? styles.inputError : null]}
        accessibilityRole="button"
        accessibilityLabel={label ?? 'Select an option'}
      >
        <BodyText style={{ color: selected ? colors.ink : colors.inkSubtle }}>
          {selected ? selected.label : placeholder}
        </BodyText>
        <BodyText color={colors.inkMuted}>▾</BodyText>
      </Pressable>

      {error ? (
        <BodyText variant="caption" color={colors.danger} style={styles.helper}>
          {error}
        </BodyText>
      ) : null}

      <Modal
        animationType="slide"
        visible={open}
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <BodyText style={typography.h3}>{title ?? label ?? 'Choose one'}</BodyText>
            <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button">
              <BodyText color={colors.accent}>Close</BodyText>
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value}
            renderItem={({ item }) => {
              const isSelected = item.value === value;
              return (
                <TouchableOpacity
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={[styles.option, isSelected ? styles.optionSelected : null]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={{ flex: 1 }}>
                    <BodyText style={{ fontWeight: isSelected ? '600' : '400' }}>
                      {item.label}
                    </BodyText>
                    {item.description ? (
                      <BodyText variant="caption" color={colors.inkMuted}>
                        {item.description}
                      </BodyText>
                    ) : null}
                  </View>
                  {isSelected ? <BodyText color={colors.accent}>✓</BodyText> : null}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.xs, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputError: { borderColor: colors.danger },
  helper: { marginTop: spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '70%',
    paddingTop: spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionSelected: { backgroundColor: colors.white },
});
